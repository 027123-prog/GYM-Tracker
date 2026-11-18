package de.hardgainwaf.tracker;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class AndroidUpdates {
    private static final String REPOSITORY = "027123-prog/GYM-Tracker";
    private static final String LATEST = "https://api.github.com/repos/" + REPOSITORY + "/releases/latest";
    private static final Pattern TAG = Pattern.compile("android-v([1-9][0-9]{0,3})\\.([0-9]{1,3})\\.([0-9]{1,3})");
    private static final long MAX_APK_SIZE = 250L * 1024 * 1024;
    private static final Set<String> DOWNLOAD_HOSTS = Set.of(
        "github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"
    );

    interface Listener { void onStatus(String status, String version); }
    private final Activity activity;
    private final Listener listener;
    private Release available;
    private boolean busy;

    private static final class Release {
        final String version;
        final long code;
        final String download;
        final String digest;
        final long size;

        Release(String version, long code, String download, String digest, long size) {
            this.version = version;
            this.code = code;
            this.download = download;
            this.digest = digest;
            this.size = size;
        }
    }

    AndroidUpdates(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
    }

    void check() {
        if (busy) return;
        busy = true;
        available = null;
        new Thread(() -> {
            try {
                Release release = fetchRelease();
                if (release == null) finish("none", null);
                else if (installedPackage().getLongVersionCode() >= release.code) finish("current", null);
                else finish("available", release);
            } catch (IOException e) {
                finish("offline", null);
            } catch (JSONException | IllegalArgumentException | PackageManager.NameNotFoundException e) {
                finish("invalid", null);
            }
        }, "hardgain-update-check").start();
    }

    void install() {
        if (busy) return;
        Release release = available;
        if (release == null) {
            finish("error", null);
            return;
        }
        if (!activity.getPackageManager().canRequestPackageInstalls()) {
            try {
                activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName())));
                finish("permission", release);
            } catch (ActivityNotFoundException | SecurityException e) {
                finish("error", release);
            }
            return;
        }

        busy = true;
        new Thread(() -> {
            File apk = null;
            try {
                apk = File.createTempFile("hardgain-update-", ".apk", activity.getCacheDir());
                download(release, apk);
                if (matchesInstalledApp(release, apk)) {
                    launchInstaller(apk);
                    finish("confirming", release);
                } else {
                    finish("invalid", null);
                }
            } catch (InvalidDownload e) {
                finish("invalid", null);
            } catch (IOException | PackageManager.NameNotFoundException | SecurityException | IllegalArgumentException e) {
                finish("error", release);
            } finally {
                if (apk != null) apk.delete();
            }
        }, "hardgain-update-install").start();
    }

    private void finish(String status, Release release) {
        activity.runOnUiThread(() -> {
            busy = false;
            available = release;
            listener.onStatus(status, release == null ? "" : release.version);
        });
    }

    private PackageInfo installedPackage() throws PackageManager.NameNotFoundException {
        return activity.getPackageManager().getPackageInfo(activity.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
    }

    private boolean matchesInstalledApp(Release release, File apk) throws PackageManager.NameNotFoundException {
        PackageInfo installed = installedPackage();
        PackageInfo candidate = activity.getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(),
            PackageManager.GET_SIGNING_CERTIFICATES);
        return candidate != null && installed.packageName.equals(candidate.packageName)
            && candidate.getLongVersionCode() == release.code && release.code > installed.getLongVersionCode()
            && installed.signingInfo != null && candidate.signingInfo != null
            && Arrays.equals(installed.signingInfo.getApkContentsSigners(), candidate.signingInfo.getApkContentsSigners());
    }

    private static Release fetchRelease() throws IOException, JSONException {
        HttpsURLConnection request = connect(new URL(LATEST), "application/vnd.github+json");
        try {
            if (request.getResponseCode() == 404) return null;
            if (request.getResponseCode() != 200) throw new IOException("GitHub API unavailable");
            JSONObject release;
            try (InputStream input = request.getInputStream(); ByteArrayOutputStream body = new ByteArrayOutputStream()) {
                transfer(input, body, 256 * 1024, null);
                release = new JSONObject(body.toString(StandardCharsets.UTF_8.name()));
            }
            String tag = release.getString("tag_name");
            Matcher version = TAG.matcher(tag);
            if (release.optBoolean("draft") || release.optBoolean("prerelease") || !version.matches()) return null;
            long code = 1000000L * Integer.parseInt(version.group(1))
                + 1000L * Integer.parseInt(version.group(2)) + Integer.parseInt(version.group(3));
            String name = tag.substring("android-v".length());
            String assetName = "HardGainWAF-" + name + ".apk";
            String url = "https://github.com/" + REPOSITORY + "/releases/download/" + tag + "/" + assetName;
            JSONArray assets = release.getJSONArray("assets");
            for (int i = 0; i < assets.length(); i++) {
                JSONObject asset = assets.getJSONObject(i);
                if (!assetName.equals(asset.optString("name"))) continue;
                String digest = asset.getString("digest");
                long size = asset.getLong("size");
                if (!digest.matches("sha256:[a-f0-9]{64}") || !url.equals(asset.optString("browser_download_url"))
                    || size < 1 || size > MAX_APK_SIZE) throw new JSONException("Invalid update asset");
                return new Release(name, code, url, digest.substring(7), size);
            }
            return null;
        } finally {
            request.disconnect();
        }
    }

    private static void download(Release release, File apk) throws IOException {
        URL url = new URL(release.download);
        for (int redirect = 0; redirect < 5; redirect++) {
            if (!"https".equals(url.getProtocol()) || !DOWNLOAD_HOSTS.contains(url.getHost())
                || url.getUserInfo() != null || (url.getPort() != -1 && url.getPort() != 443)) {
                throw new InvalidDownload();
            }
            HttpsURLConnection request = connect(url, "application/octet-stream");
            try {
                int status = request.getResponseCode();
                if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                    String target = request.getHeaderField("Location");
                    if (target == null) throw new InvalidDownload();
                    url = new URL(url, target);
                    continue;
                }
                if (status != 200) throw new IOException("Download unavailable");
                MessageDigest sha256 = sha256();
                long received;
                try (InputStream input = request.getInputStream(); OutputStream output = new FileOutputStream(apk)) {
                    received = transfer(input, output, release.size, sha256);
                }
                StringBuilder actual = new StringBuilder(64);
                for (byte value : sha256.digest()) actual.append(String.format(Locale.ROOT, "%02x", value & 0xff));
                if (received != release.size || !release.digest.contentEquals(actual)) throw new InvalidDownload();
                return;
            } finally {
                request.disconnect();
            }
        }
        throw new InvalidDownload();
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static long transfer(InputStream input, OutputStream output, long limit, MessageDigest digest) throws IOException {
        byte[] buffer = new byte[32768];
        long total = 0;
        int read;
        while ((read = input.read(buffer)) != -1) {
            total += read;
            if (total > limit) throw new InvalidDownload();
            output.write(buffer, 0, read);
            if (digest != null) digest.update(buffer, 0, read);
        }
        return total;
    }

    private static HttpsURLConnection connect(URL url, String accept) throws IOException {
        HttpsURLConnection request = (HttpsURLConnection) url.openConnection();
        request.setInstanceFollowRedirects(false);
        request.setConnectTimeout(12000);
        request.setReadTimeout(20000);
        request.setRequestProperty("Accept", accept);
        request.setRequestProperty("User-Agent", "HardGainWAF-Android");
        return request;
    }

    private void launchInstaller(File apk) throws IOException {
        PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(activity.getPackageName());
        params.setSize(apk.length());
        if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
        int id = installer.createSession(params);
        boolean committed = false;
        try (PackageInstaller.Session session = installer.openSession(id)) {
            try (InputStream input = new FileInputStream(apk); OutputStream output = session.openWrite("base.apk", 0, apk.length())) {
                transfer(input, output, apk.length(), null);
                session.fsync(output);
            }
            Intent result = new Intent(activity, UpdateConfirmationActivity.class);
            PendingIntent pending = PendingIntent.getActivity(activity, id, result,
                PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            session.commit(pending.getIntentSender());
            committed = true;
        } finally {
            if (!committed) installer.abandonSession(id);
        }
    }

    private static final class InvalidDownload extends IOException {}
}
