package de.hardgainwaf.tracker;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String PREFIX = "/assets/www/";
    private static final String START_URL = "https://" + HOST + PREFIX + "index.html";
    private static final int PICK_IMPORT = 10;
    private static final int PICK_EXPORT = 11;

    private FrameLayout frame;
    private WebView web;
    private AndroidUpdates updates;
    private ValueCallback<Uri[]> importCallback;
    private String pendingExport;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setDecorFitsSystemWindows(false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarContrastEnforced(false);
        frame = new FrameLayout(this);
        web = new WebView(this);
        frame.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(frame);
        frame.setOnApplyWindowInsetsListener((view, insets) -> {
            Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
            return WindowInsets.CONSUMED;
        });
        updateChrome(false);
        updates = new AndroidUpdates(this, this::updateStatus);

        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(true);
        web.addJavascriptInterface(new AndroidBridge(), "HardGainAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return serveAsset(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isAppUrl(request.getUrl());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (importCallback != null) importCallback.onReceiveValue(null);
                importCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                if (!launchPicker(intent, PICK_IMPORT)) {
                    importCallback = null;
                    callback.onReceiveValue(null);
                }
                return true;
            }
        });
        web.loadUrl(START_URL);
    }

    private static boolean isAppUrl(Uri url) {
        String path = url.getPath();
        return "https".equals(url.getScheme()) && HOST.equals(url.getAuthority())
            && path != null && path.startsWith(PREFIX) && !path.contains("..") && path.matches("[a-zA-Z0-9_./-]+");
    }

    private WebResourceResponse serveAsset(Uri url) {
        if (isAppUrl(url)) {
            String relative = url.getPath().substring(PREFIX.length());
            String mime = mimeType(relative);
            String encoding = mime.startsWith("text/") || mime.equals("application/json") ? "UTF-8" : null;
            try {
                return new WebResourceResponse(mime, encoding, 200, "OK", Map.of(
                    "Cache-Control", "no-store",
                    "X-Content-Type-Options", "nosniff",
                    "Content-Security-Policy", "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; "
                        + "connect-src 'self' blob:; img-src 'self' data: blob:; frame-src 'none'; object-src 'none'; base-uri 'none'"
                ), getAssets().open("www/" + relative));
            } catch (IOException ignored) {
                // All resources are packaged in the APK.
            }
        }
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Map.of(), new ByteArrayInputStream(new byte[0]));
    }

    private static String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".ttf")) return "font/ttf";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".txt") || path.endsWith(".md")) return "text/plain";
        return "application/octet-stream";
    }

    private void updateChrome(boolean light) {
        frame.setBackgroundColor(light ? 0xfff8f5ee : 0xff191919);
        int flags = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
        WindowInsetsController controller = getWindow().getInsetsController();
        if (controller != null) controller.setSystemBarsAppearance(light ? flags : 0, flags);
    }

    private boolean launchPicker(Intent intent, int request) {
        try {
            startActivityForResult(intent, request);
            return true;
        } catch (ActivityNotFoundException e) {
            return false;
        }
    }

    public final class AndroidBridge {
        @JavascriptInterface
        public void checkForUpdate() {
            runOnUiThread(updates::check);
        }

        @JavascriptInterface
        public void installUpdate() {
            runOnUiThread(updates::install);
        }

        @JavascriptInterface
        public void setLightTheme(boolean light) {
            runOnUiThread(() -> updateChrome(light));
        }

        @JavascriptInterface
        public void saveBackup(String filename, String json) {
            runOnUiThread(() -> {
                if (pendingExport != null) return;
                pendingExport = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("application/json").putExtra(Intent.EXTRA_TITLE, filename);
                if (!launchPicker(intent, PICK_EXPORT)) {
                    pendingExport = null;
                    exportResult("error");
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        if (uri != null && !"content".equals(uri.getScheme())) uri = null;
        if (request == PICK_IMPORT && importCallback != null) {
            ValueCallback<Uri[]> callback = importCallback;
            importCallback = null;
            callback.onReceiveValue(uri == null ? null : new Uri[]{uri});
        } else if (request == PICK_EXPORT && pendingExport != null) {
            String json = pendingExport;
            pendingExport = null;
            if (uri == null) exportResult("cancelled");
            else writeBackup(uri, json);
        }
    }

    private void writeBackup(Uri uri, String json) {
        new Thread(() -> {
            String result = "saved";
            try (OutputStream output = getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IOException("Document not available");
                output.write(json.getBytes(StandardCharsets.UTF_8));
            } catch (IOException | SecurityException e) {
                result = "error";
            }
            String status = result;
            runOnUiThread(() -> exportResult(status));
        }).start();
    }

    private void exportResult(String status) {
        if (!isDestroyed()) {
            web.evaluateJavascript("window.dispatchEvent(new CustomEvent('hardgain-backup-export', {detail:'" + status + "'}))", null);
        }
    }

    private void updateStatus(String status, String version) {
        if (!isDestroyed()) {
            web.evaluateJavascript("window.dispatchEvent(new CustomEvent('hardgain-android-update', {detail:{status:"
                + JSONObject.quote(status) + ",version:" + JSONObject.quote(version) + "}}))", null);
        }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
            "(() => { const dialog = document.querySelector('[role=dialog]'); if (!dialog) return false;"
                + "document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})); return true; })()",
            closed -> {
                if ("true".equals(closed)) return;
                if (web.canGoBack()) web.goBack();
                else super.onBackPressed();
            });
    }
}
