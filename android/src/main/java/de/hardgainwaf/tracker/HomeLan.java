package de.hardgainwaf.tracker;

import android.net.ConnectivityManager;
import android.net.DnsResolver;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.CancellationSignal;
import android.os.SystemClock;
import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Sources of local addresses. Only HomeSync's pinned HTTPS transport can establish identity. */
final class HomeLan {
    private static final int DISCOVERY_PORT = 8770;
    private static final byte[] QUERY = "BITFARM-RAUMKLIMA/1?".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] ANSWER = "BITFARM-RAUMKLIMA/1!".getBytes(StandardCharsets.US_ASCII);
    final Network network;
    private final List<LinkAddress> local = new ArrayList<>();

    private HomeLan(Network network, LinkProperties links) {
        this.network = network;
        for (LinkAddress link : links.getLinkAddresses()) {
            if (link.getAddress() instanceof Inet4Address && link.getAddress().isSiteLocalAddress()) local.add(link);
        }
    }

    static List<HomeLan> connected(ConnectivityManager manager) {
        Set<Network> networks = new LinkedHashSet<>();
        networks.add(manager.getActiveNetwork());
        networks.addAll(Arrays.asList(manager.getAllNetworks()));
        List<HomeLan> result = new ArrayList<>();
        for (Network network : networks) {
            if (network == null) continue;
            NetworkCapabilities caps = manager.getNetworkCapabilities(network);
            LinkProperties links = manager.getLinkProperties(network);
            if (caps == null || links == null || caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
                || !(caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))) continue;
            HomeLan lan = new HomeLan(network, links);
            if (!lan.local.isEmpty()) result.add(lan);
        }
        return result;
    }

    boolean includes(String ip) {
        if (!HomeSync.isLanIp(ip)) return false;
        try {
            int address = number(InetAddress.getByName(ip));
            for (LinkAddress link : local) {
                int prefix = link.getPrefixLength();
                if (prefix > 0 && ((address ^ number(link.getAddress())) >>> (32 - prefix)) == 0) return true;
            }
        } catch (IOException ignored) { }
        return false;
    }

    private static int number(InetAddress address) {
        int n = 0;
        for (byte b : address.getAddress()) n = (n << 8) | (b & 255);
        return n;
    }

    Set<String> discover() {
        Set<String> candidates = new LinkedHashSet<>();
        try (DatagramSocket socket = new DatagramSocket()) {
            network.bindSocket(socket);
            socket.setBroadcast(true);
            for (LinkAddress link : local) {
                if (link.getPrefixLength() < 8 || link.getPrefixLength() >= 31) continue;
                byte[] bytes = link.getAddress().getAddress();
                for (int bit = link.getPrefixLength(); bit < 32; bit++) bytes[bit / 8] |= 1 << (7 - bit % 8);
                InetAddress broadcast = InetAddress.getByAddress(bytes);
                if (broadcast.isSiteLocalAddress()) socket.send(new DatagramPacket(QUERY, QUERY.length, broadcast, DISCOVERY_PORT));
            }
            long until = SystemClock.elapsedRealtime() + 850;
            for (int count = 0; count < 64 && candidates.size() < 12; count++) {
                int left = (int)(until - SystemClock.elapsedRealtime());
                if (left <= 0) break;
                socket.setSoTimeout(left);
                DatagramPacket reply = new DatagramPacket(new byte[ANSWER.length + 1], ANSWER.length + 1);
                socket.receive(reply);
                String ip = reply.getAddress().getHostAddress();
                if (reply.getPort() == DISCOVERY_PORT && reply.getLength() == ANSWER.length && includes(ip)
                    && Arrays.equals(ANSWER, Arrays.copyOf(reply.getData(), reply.getLength()))) candidates.add(ip);
            }
        } catch (IOException ignored) { /* A router can disable broadcasts; local DNS is the next source. */ }
        return candidates;
    }

    Set<String> resolve(String name) {
        Set<String> result = new LinkedHashSet<>();
        if (name.isEmpty()) return result;
        String[] names = name.toLowerCase(java.util.Locale.ROOT).endsWith(".local") ? new String[]{name} : new String[]{name, name + ".local"};
        CountDownLatch done = new CountDownLatch(names.length);
        CancellationSignal[] cancel = new CancellationSignal[names.length];
        try {
            for (int i = 0; i < names.length; i++) {
                cancel[i] = new CancellationSignal();
                DnsResolver.getInstance().query(network, names[i], DnsResolver.FLAG_EMPTY, Runnable::run, cancel[i],
                    new DnsResolver.Callback<List<InetAddress>>() {
                        public void onAnswer(List<InetAddress> answer, int code) {
                            synchronized (result) {
                                for (InetAddress address : answer) {
                                    String ip = address.getHostAddress();
                                    if (address instanceof Inet4Address && includes(ip)) result.add(ip);
                                }
                            }
                            done.countDown();
                        }
                        public void onError(DnsResolver.DnsException error) { done.countDown(); }
                    });
            }
            done.await(1100, TimeUnit.MILLISECONDS);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        } finally {
            for (CancellationSignal signal : cancel) if (signal != null) signal.cancel();
        }
        synchronized (result) { return new LinkedHashSet<>(result); }
    }
}
