package de.hardgainwaf.tracker;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONException;
import org.json.JSONObject;

/** Delivers offline edits when Android supplies an unmetered network, including after a reboot. */
public final class HomeSyncJob extends JobService {
    private static final int JOB = 417601;
    private static final int STATE_LIMIT = 32 * 1024 * 1024;
    private static final String QUEUE = "home-sync-outbox";
    private static final String RECEIPT = "home-sync-delivered";
    private static final ExecutorService WRITER = Executors.newSingleThreadExecutor();
    private static final Object FILES = new Object();
    // A new local edit (including reverting the last edit) is compared with the latest delivery receipt.
    private static final Object DELIVERY = new Object();
    // A newly opened activity must see the result of a reconcile already on the wire.
    static final Object TRANSFER = new Object();
    private static final AtomicInteger visibleActivities = new AtomicInteger();
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile JobParameters running;

    static void enterForeground() { visibleActivities.incrementAndGet(); }

    static void leaveForeground(Context context) {
        if (visibleActivities.decrementAndGet() == 0) WRITER.execute(() -> {
            synchronized (FILES) {
                if (file(context, QUEUE).getBaseFile().exists()) schedule(context, true);
            }
        });
    }

    private static AtomicFile file(Context context, String name) {
        return new AtomicFile(new File(context.getNoBackupFilesDir(), name + ".json"));
    }

    private static JSONObject read(Context context, String name) throws IOException, JSONException {
        try {
            return new JSONObject(new String(file(context, name).readFully(), StandardCharsets.UTF_8));
        } catch (FileNotFoundException missing) {
            return null;
        }
    }

    private static void write(Context context, String name, JSONObject data) throws IOException {
        AtomicFile file = file(context, name);
        FileOutputStream output = file.startWrite();
        try {
            output.write(data.toString().getBytes(StandardCharsets.UTF_8));
            file.finishWrite(output);
        } catch (IOException | RuntimeException error) {
            file.failWrite(output);
            throw error;
        }
    }

    private static boolean belongsTo(JSONObject record, String pairId) {
        return record != null && pairId != null && pairId.equals(record.optString("pairId"));
    }

    private static String pairId(Context context, String serverId) {
        Map<String, ?> settings = HomeSync.preferences(context).getAll();
        if (serverId == null || !serverId.equals(settings.get("serverId"))) return null;
        return (String) settings.get("pairId");
    }

    private static void schedule(Context context, boolean replace) {
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (!replace && scheduler.getPendingJob(JOB) != null) return;
        JobInfo job = new JobInfo.Builder(JOB, new ComponentName(context, HomeSyncJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_UNMETERED)
            .setPersisted(true)
            .setMinimumLatency(5000)
            .setBackoffCriteria(60000, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
            .build();
        scheduler.schedule(job);
    }

    static void disconnected(Context context) {
        synchronized (FILES) {
            context.getSystemService(JobScheduler.class).cancel(JOB);
            file(context, QUEUE).delete();
            file(context, RECEIPT).delete();
        }
    }

    static void mirror(Context context, String serverId, String revision, String base, String local) {
        String tag = pairId(context, serverId);
        if (tag == null || revision == null || !revision.matches("[0-9]{1,16}")
            || base == null || local == null || base.length() > STATE_LIMIT || local.length() > STATE_LIMIT
            || !base.startsWith("{") || !local.startsWith("{")) return;
        long baseRevision = Long.parseLong(revision);
        WRITER.execute(() -> {
            synchronized (DELIVERY) {
                synchronized (FILES) {
                    if (!tag.equals(pairId(context, serverId))) return;
                    try {
                        JSONObject previous = read(context, RECEIPT);
                        boolean fromReceipt = belongsTo(previous, tag) && previous.getLong("baseRevision") == baseRevision;
                        if (!fromReceipt) file(context, RECEIPT).delete();
                        String acknowledged = fromReceipt ? previous.getString("localJson") : base;
                        if (acknowledged.equals(local)) {
                            file(context, QUEUE).delete();
                            context.getSystemService(JobScheduler.class).cancel(JOB);
                            return;
                        }
                        JSONObject packet = new JSONObject().put("pairId", tag).put("serverId", serverId)
                            .put("packetId", UUID.randomUUID().toString()).put("baseRevision", baseRevision)
                            .put("baseJson", base).put("localJson", local);
                        // A completed job may still await jobFinished() on the main thread.
                        boolean firstPending = !file(context, QUEUE).getBaseFile().exists();
                        write(context, QUEUE, packet);
                        schedule(context, firstPending);
                    } catch (IOException | JSONException ignored) {
                        // The WebView still holds the full workout and re-mirrors on its next foreground sync.
                    }
                }
            }
        });
    }

    static String receipt(Context context) {
        synchronized (DELIVERY) {
            synchronized (FILES) {
                try {
                    JSONObject record = read(context, RECEIPT);
                    if (record == null) return "null";
                    String serverId = record.getString("serverId");
                    if (!belongsTo(record, pairId(context, serverId))) return "null";
                    return "{\"serverId\":" + JSONObject.quote(serverId) + ",\"baseRevision\":" + record.getLong("baseRevision")
                        + ",\"revision\":" + record.getLong("revision") + ",\"localState\":" + record.getString("localJson") + "}";
                } catch (IOException | JSONException error) { return "null"; }
            }
        }
    }

    @Override
    public boolean onStartJob(JobParameters parameters) {
        running = parameters;
        new Thread(() -> {
            boolean retry;
            synchronized (TRANSFER) {
                synchronized (DELIVERY) {
                    try { retry = deliver(parameters); }
                    catch (IOException | GeneralSecurityException | JSONException | RuntimeException error) { retry = true; }
                }
            }
            final boolean reschedule = retry;
            main.post(() -> {
                if (running == parameters) {
                    running = null;
                    jobFinished(parameters, reschedule);
                }
            });
        }, "Gym WLAN Sync").start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters parameters) {
        if (running == parameters) running = null;
        return true;
    }

    private boolean deliver(JobParameters parameters) throws IOException, GeneralSecurityException, JSONException {
        JSONObject packet, receipt;
        String tag, serverId;
        synchronized (FILES) {
            packet = read(this, QUEUE);
            if (packet == null) return false;
            serverId = packet.getString("serverId");
            tag = pairId(this, serverId);
            if (!belongsTo(packet, tag)) return false;
            if (running != parameters || visibleActivities.get() > 0) return true;
            receipt = read(this, RECEIPT);
        }
        long baseRevision = packet.getLong("baseRevision");
        boolean continued = belongsTo(receipt, tag) && baseRevision == receipt.getLong("baseRevision");
        long ancestorRevision = continued ? receipt.getLong("revision") : baseRevision;
        String ancestor = continued ? receipt.getString("localJson") : packet.getString("baseJson");
        String local = packet.getString("localJson");
        String body = "{\"serverId\":" + JSONObject.quote(serverId) + ",\"baseRevision\":" + ancestorRevision
            + ",\"baseState\":" + ancestor + ",\"localState\":" + local + "}";
        HomeSync transport = new HomeSync(this, null);
        HomeSync.Reply reply;
        try { reply = transport.reconcile(serverId, tag, body); }
        finally { transport.close(); }
        synchronized (FILES) {
            if (!tag.equals(pairId(this, serverId))) return false;
            JSONObject current = read(this, QUEUE);
            boolean newer = current != null && !packet.getString("packetId").equals(current.getString("packetId"));
            if (reply.status != 200) return newer || reply.status >= 500 || reply.status == 429;
            JSONObject ack = new JSONObject(reply.body);
            if (!serverId.equals(ack.getString("serverId")) || ack.getLong("revision") < ancestorRevision) return true;
            JSONObject delivered = new JSONObject().put("pairId", tag).put("serverId", serverId)
                .put("baseRevision", baseRevision).put("revision", ack.getLong("revision")).put("localJson", local);
            write(this, RECEIPT, delivered);
            if (!newer) file(this, QUEUE).delete();
            return newer;
        }
    }
}
