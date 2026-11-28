package de.hardgainwaf.tracker;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.Proxy;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLPeerUnverifiedException;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import org.json.JSONException;
import org.json.JSONObject;

/** Android transport for the paired PC. The bearer stays in app-private storage. */
final class HomeSync {
    interface Callback {
        void complete(String id, int status, String body);
    }

    private static final int PORT = 4176;
    private static final int LIMIT = 32 * 1024 * 1024;
    private static final String PAIR = "/api/home-sync/pair";
    private static final String STATE = "/api/home-sync/state";
    private static final String RECONCILE = "/api/home-sync/reconcile";
    private final Context context;
    private final SharedPreferences prefs;
    private final ConnectivityManager networks;
    private final Callback callback;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile String pendingLink;
    private volatile int generation;
    private HttpsURLConnection active;

    HomeSync(Context context, Callback callback) {
        this.context = context.getApplicationContext();
        this.prefs = preferences(context);
        this.networks = context.getSystemService(ConnectivityManager.class);
        this.callback = callback;
    }

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("home-sync", Context.MODE_PRIVATE);
    }

    private static boolean isLanIp(String host) {
        if (host == null || !host.matches("(?:[0-9]{1,3}\\.){3}[0-9]{1,3}")) return false;
        String[] parts = host.split("\\.");
        int[] n = new int[4];
        for (int i = 0; i < 4; i++) {
            n[i] = Integer.parseInt(parts[i]);
            if (n[i] > 255 || !Integer.toString(n[i]).equals(parts[i])) return false;
        }
        return n[0] == 10 || (n[0] == 172 && n[1] >= 16 && n[1] <= 31) || (n[0] == 192 && n[1] == 168);
    }

    private static boolean validSecret(String value) {
        return value != null && value.matches("[a-zA-Z0-9_-]{16,256}");
    }

    private static final class Peer {
        final String host, name, pin, code;
        Peer(String host, String name, String pin, String code) {
            this.host = host;
            this.name = name;
            this.pin = pin;
            this.code = code;
        }
    }

    private static Peer parse(String link) {
        if (link == null || link.length() > 2048) throw new IllegalArgumentException();
        Uri uri = Uri.parse(link.trim());
        if (!"hardgainwaf".equals(uri.getScheme()) || !"pair".equals(uri.getEncodedAuthority())
            || (uri.getPath() != null && !uri.getPath().isEmpty() && !"/".equals(uri.getPath()))
            || uri.getFragment() != null) throw new IllegalArgumentException();
        String host = uri.getQueryParameter("host");
        String pin = uri.getQueryParameter("pin");
        String code = uri.getQueryParameter("code");
        String name = uri.getQueryParameter("name");
        if (!isLanIp(host) || !"4176".equals(uri.getQueryParameter("port"))
            || pin == null || !pin.matches("[0-9A-Fa-f]{64}") || !validSecret(code)) throw new IllegalArgumentException();
        if (name != null && !name.matches("(?i)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.local)?")) name = "";
        return new Peer(host, name == null ? "" : name, pin.toLowerCase(Locale.ROOT), code);
    }

    boolean acceptLink(String link) {
        try {
            parse(link);
            pendingLink = link;
            return true;
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

    String status() {
        try {
            JSONObject result = new JSONObject();
            result.put("paired", prefs.contains("token"));
            result.put("serverId", prefs.getString("serverId", null));
            result.put("pendingLink", pendingLink);
            return result.toString();
        } catch (JSONException error) {
            throw new IllegalStateException(error);
        }
    }

    void dismissLink() {
        pendingLink = null;
    }

    synchronized void forget() {
        generation++;
        pendingLink = null;
        prefs.edit().clear().commit();
        HomeSyncJob.disconnected(context);
        if (active != null) active.disconnect();
    }

    synchronized void close() {
        generation++;
        if (active != null) active.disconnect();
        worker.shutdownNow();
    }

    private Network activeLan() throws IOException {
        Network network = networks.getActiveNetwork();
        NetworkCapabilities caps = network == null ? null : networks.getNetworkCapabilities(network);
        if (caps == null || !(caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
            || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))) throw new IOException("Kein WLAN");
        return network;
    }

    private static boolean matchesPin(X509Certificate cert, String pin) throws GeneralSecurityException {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(cert.getEncoded());
        byte[] expected = new byte[digest.length];
        for (int i = 0; i < expected.length; i++) expected[i] = (byte) Integer.parseInt(pin.substring(2 * i, 2 * i + 2), 16);
        return MessageDigest.isEqual(digest, expected);
    }

    private static SSLContext tls(String pin) throws GeneralSecurityException {
        X509TrustManager trust = new X509TrustManager() {
            public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
            public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                throw new CertificateException("No client certificates");
            }
            public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                try {
                    if (chain == null || chain.length == 0 || !matchesPin(chain[0], pin)) throw new CertificateException("Anderer PC");
                    chain[0].checkValidity();
                } catch (GeneralSecurityException error) {
                    throw new CertificateException(error);
                }
            }
        };
        SSLContext context = SSLContext.getInstance("TLS");
        context.init(null, new TrustManager[]{trust}, null);
        return context;
    }

    static final class Reply {
        final int status;
        final String body;
        Reply(int status, String body) { this.status = status; this.body = body; }
    }

    private static final class PeerUnreachable extends IOException {
        PeerUnreachable(IOException cause) { super(cause); }
    }

    private Reply exchange(int epoch, Peer peer, String path, String method, String token, String revision, String body)
        throws IOException, GeneralSecurityException {
        Network lan = activeLan();
        SSLContext context = tls(peer.pin);
        try {
            return send(lan, epoch, context, peer.host, peer.pin, path, method, token, revision, body);
        } catch (PeerUnreachable first) {
            // Only retry a connection that never sent the operation, not a lost response.
            if (peer.name.isEmpty()) throw first;
            for (InetAddress address : lan.getAllByName(peer.name)) {
                String ip = address.getHostAddress();
                if (isLanIp(ip) && !ip.equals(peer.host)) {
                    try { return send(lan, epoch, context, ip, peer.pin, path, method, token, revision, body); }
                    catch (PeerUnreachable unavailable) { /* Try the next private DNS result. */ }
                }
            }
            throw first;
        }
    }

    private Reply send(Network network, int epoch, SSLContext context, String host, String pin,
                       String path, String method, String token, String revision, String body)
        throws IOException {
        URL url = new URL("https", host, PORT, path);
        HttpsURLConnection connection = (HttpsURLConnection) network.openConnection(url, Proxy.NO_PROXY);
        try {
            synchronized (this) {
                if (epoch != generation) throw new IOException("Verbindung beendet");
                active = connection;
            }
            connection.setSSLSocketFactory(context.getSocketFactory());
            // The QR fingerprint identifies this PC, including when its LAN address changes.
            connection.setHostnameVerifier((ignored, session) -> {
                try { return matchesPin((X509Certificate) session.getPeerCertificates()[0], pin); }
                catch (GeneralSecurityException | SSLPeerUnverifiedException error) { return false; }
            });
            connection.setRequestMethod(method);
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            connection.setConnectTimeout(3500);
            connection.setReadTimeout(12000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("X-HardGain-Sync", "1");
            if (token != null) connection.setRequestProperty("Authorization", "Bearer " + token);
            if ("GET".equals(method) && revision != null && !revision.isEmpty()) {
                connection.setRequestProperty("If-None-Match", "\"" + revision + "\"");
            }
            byte[] payload = body == null ? null : body.getBytes(StandardCharsets.UTF_8);
            if (payload != null) {
                if (payload.length > (RECONCILE.equals(path) ? 2 * LIMIT + 4096 : LIMIT)) return new Reply(413, "");
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(payload.length);
                connection.setRequestProperty("Content-Type", "application/json");
            }
            try { connection.connect(); }
            catch (IOException error) { throw new PeerUnreachable(error); }
            if (payload != null) {
                try (OutputStream output = connection.getOutputStream()) { output.write(payload); }
            }
            int status = connection.getResponseCode();
            if (status == 304 || status == 204 || (status >= 300 && status < 400)) return new Reply(status, "");
            try (InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream()) {
                if (input == null) return new Reply(status, "");
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (bytes.size() + count > LIMIT) throw new IOException("Antwort zu groß");
                    bytes.write(buffer, 0, count);
                }
                return new Reply(status, bytes.toString("UTF-8"));
            }
        } finally {
            connection.disconnect();
            synchronized (this) { if (active == connection) active = null; }
        }
    }

    void pair(String id, String link) {
        final Peer peer;
        try { peer = parse(link); }
        catch (IllegalArgumentException error) { callback.complete(id, 400, ""); return; }
        final int epoch = generation;
        worker.execute(() -> {
            try {
                String body = new JSONObject().put("code", peer.code).toString();
                Reply reply = exchange(epoch, peer, PAIR, "POST", null, null, body);
                if (reply.status < 200 || reply.status >= 300) { callback.complete(id, reply.status, ""); return; }
                JSONObject response = new JSONObject(reply.body);
                String token = response.getString("token"), serverId = response.getString("serverId");
                if (!validSecret(token) || !serverId.matches("[A-Za-z0-9_-]{1,128}")) throw new IOException("Ungültige Kopplung");
                synchronized (this) {
                    if (epoch != generation) throw new IOException("Verbindung geändert");
                    if (!prefs.edit().putString("host", peer.host).putString("name", peer.name).putString("pin", peer.pin)
                        .putString("token", token).putString("serverId", serverId)
                        .putString("pairId", UUID.randomUUID().toString()).commit()) throw new IOException("Speicherfehler");
                    HomeSyncJob.disconnected(context);
                    generation++;
                    pendingLink = null;
                }
                callback.complete(id, reply.status, new JSONObject().put("serverId", serverId).toString());
            } catch (IOException | GeneralSecurityException | JSONException | RuntimeException error) {
                callback.complete(id, 0, "");
            }
        });
    }

    Reply reconcile(String serverId, String pairId, String body) throws IOException, GeneralSecurityException {
        var saved = prefs.getAll();
        if (!serverId.equals(saved.get("serverId")) || !pairId.equals(saved.get("pairId"))) return new Reply(401, "");
        Peer peer = new Peer((String) saved.get("host"), (String) saved.get("name"), (String) saved.get("pin"), null);
        return exchange(generation, peer, RECONCILE, "POST", (String) saved.get("token"), null, body);
    }

    void request(String id, String method, String revision, String body) {
        if (!"GET".equals(method) && !"PUT".equals(method)
            || revision != null && !revision.matches("[A-Za-z0-9_-]{0,128}")
            || "PUT".equals(method) && (body == null || body.length() > LIMIT)) {
            callback.complete(id, 400, "");
            return;
        }
        final int epoch = generation;
        worker.execute(() -> {
            try {
                String token = prefs.getString("token", null);
                if (token == null) { callback.complete(id, 401, ""); return; }
                Peer peer = new Peer(prefs.getString("host", ""), prefs.getString("name", ""), prefs.getString("pin", ""), null);
                Reply reply;
                synchronized (HomeSyncJob.TRANSFER) {
                    reply = exchange(epoch, peer, STATE, method, token, revision, "PUT".equals(method) ? body : null);
                }
                if (epoch != generation) { callback.complete(id, 0, ""); return; }
                callback.complete(id, reply.status, reply.body);
            } catch (IOException | GeneralSecurityException | RuntimeException error) {
                callback.complete(id, 0, "");
            }
        });
    }
}
