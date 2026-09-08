package games.dustline.forge;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Installs a newer release APK over the running one.
 *
 * This works — without an uninstall, and without losing app data — only while
 * two things hold, and the release workflow guarantees both:
 *   - the applicationId never changes, and
 *   - every APK is signed with the same certificate.
 * Android refuses an update whose signature differs from the installed app,
 * which is exactly what happens when builds are signed with per-machine debug
 * keys. See docs/ANDROID_RELEASE.md.
 */
@CapacitorPlugin(name = "ForgeUpdater")
public class ForgeUpdaterPlugin extends Plugin {

    private static final String UPDATE_DIR = "updates";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /** Version of the running build, as Android itself sees it. */
    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            Activity activity = getActivity();
            PackageManager pm = activity.getPackageManager();
            PackageInfo info = pm.getPackageInfo(activity.getPackageName(), 0);

            long versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = info.getLongVersionCode();
            } else {
                versionCode = info.versionCode;
            }

            JSObject result = new JSObject();
            result.put("packageName", info.packageName);
            result.put("versionName", info.versionName);
            result.put("versionCode", versionCode);
            call.resolve(result);
        } catch (PackageManager.NameNotFoundException e) {
            call.reject("Could not read package info", e);
        }
    }

    /**
     * Android 8+ gates sideloaded installs behind a per-app "install unknown
     * apps" toggle. Below that the legacy global setting applies, and the
     * install intent handles it.
     */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            result.put("granted", getActivity().getPackageManager().canRequestPackageInstalls());
        } else {
            result.put("granted", true);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void requestInstallPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                    .setData(Uri.parse("package:" + getActivity().getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
        }
        call.resolve();
    }

    /**
     * Downloads the APK to the app cache and hands it to the system installer.
     * The user still confirms the install — this replaces "download in a
     * browser, find the file, tap it", not the confirmation itself.
     */
    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String url = call.getString("url");
        final String versionName = call.getString("versionName", "latest");
        if (url == null || url.isEmpty()) {
            call.reject("Missing url");
            return;
        }

        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                File dir = new File(getContext().getCacheDir(), UPDATE_DIR);
                if (!dir.exists() && !dir.mkdirs()) {
                    call.reject("Could not create the download directory");
                    return;
                }
                // Keep only the download in flight; old APKs are dead weight.
                File[] stale = dir.listFiles();
                if (stale != null) {
                    for (File f : stale) {
                        //noinspection ResultOfMethodCallIgnored
                        f.delete();
                    }
                }

                File target = new File(dir, "forge-" + versionName + ".apk");

                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(60000);
                connection.connect();

                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                    call.reject("Download failed: HTTP " + status);
                    return;
                }

                long total = connection.getContentLengthLong();
                long read = 0;
                int lastPercent = -1;

                try (InputStream in = connection.getInputStream();
                     OutputStream out = new FileOutputStream(target)) {
                    byte[] buffer = new byte[16 * 1024];
                    int n;
                    while ((n = in.read(buffer)) != -1) {
                        out.write(buffer, 0, n);
                        read += n;
                        if (total > 0) {
                            int percent = (int) ((read * 100) / total);
                            if (percent != lastPercent) {
                                lastPercent = percent;
                                JSObject progress = new JSObject();
                                progress.put("percent", percent);
                                progress.put("bytes", read);
                                progress.put("total", total);
                                notifyListeners("downloadProgress", progress);
                            }
                        }
                    }
                    out.flush();
                }

                if (target.length() == 0) {
                    call.reject("Downloaded file was empty");
                    return;
                }

                Uri uri = FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        target
                );

                Intent install = new Intent(Intent.ACTION_VIEW)
                        .setDataAndType(uri, "application/vnd.android.package-archive")
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(install);

                JSObject result = new JSObject();
                result.put("started", true);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Update failed: " + e.getMessage(), e);
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        });
    }
}
