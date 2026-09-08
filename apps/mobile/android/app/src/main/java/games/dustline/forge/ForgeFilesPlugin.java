package games.dustline.forge;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Puts an exported model somewhere the user can actually find it: the phone's
 * public Downloads folder, where Chrome's downloads list, the Files app and
 * anything else that reads shared storage will see it.
 *
 * Models otherwise live in app-private storage, which is invisible to every
 * other app. The Share sheet covers "send it somewhere"; this covers "put it
 * on my phone so I can find it later".
 */
@CapacitorPlugin(name = "ForgeFiles")
public class ForgeFilesPlugin extends Plugin {

    private static final String MIME_GLB = "model/gltf-binary";

    /**
     * @param sourcePath absolute path of the file to copy
     * @param name       filename to use in Downloads
     */
    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String sourcePath = call.getString("sourcePath");
        String name = call.getString("name", "model.glb");
        if (sourcePath == null || sourcePath.isEmpty()) {
            call.reject("Missing sourcePath");
            return;
        }

        File source = new File(sourcePath.replaceFirst("^file://", ""));
        if (!source.exists()) {
            call.reject("The model file is no longer on this device");
            return;
        }

        try {
            String uri =
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                            ? saveViaMediaStore(source, name)
                            : saveLegacy(source, name);

            JSObject result = new JSObject();
            result.put("uri", uri);
            result.put("name", name);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not save to Downloads: " + e.getMessage(), e);
        }
    }

    /**
     * Android 10+ has no direct write access to shared storage, so the file is
     * handed to MediaStore, which places it in Downloads and indexes it.
     */
    private String saveViaMediaStore(File source, String name) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();

        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, name);
        values.put(MediaStore.Downloads.MIME_TYPE, MIME_GLB);
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri target = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (target == null) throw new IllegalStateException("Downloads is not writable");

        try (InputStream in = new FileInputStream(source);
             OutputStream out = resolver.openOutputStream(target)) {
            if (out == null) throw new IllegalStateException("Could not open Downloads for writing");
            copy(in, out);
        }

        // Clearing IS_PENDING is what makes the file visible to other apps.
        values.clear();
        values.put(MediaStore.Downloads.IS_PENDING, 0);
        resolver.update(target, values, null, null);

        return target.toString();
    }

    /** Below Android 10, Downloads is a plain directory. */
    private String saveLegacy(File source, String name) throws Exception {
        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Could not open the Downloads folder");
        }
        File target = new File(dir, name);
        try (InputStream in = new FileInputStream(source);
             OutputStream out = new FileOutputStream(target)) {
            copy(in, out);
        }
        return Uri.fromFile(target).toString();
    }

    private static void copy(InputStream in, OutputStream out) throws Exception {
        byte[] buffer = new byte[16 * 1024];
        int n;
        while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
        out.flush();
    }
}
