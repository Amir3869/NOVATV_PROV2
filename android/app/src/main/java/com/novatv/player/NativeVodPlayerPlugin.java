package com.novatv.player;

import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lecture VOD par ExoPlayer, sous la WebView.
 *
 * Chrome Android ne décode pas l'AC-3 : image sans son. ExoPlayer
 * utilise le décodeur matériel Samsung. Le chrome HTML reste au-dessus
 * (WebView transparente). Le direct n'emprunte pas ce plugin.
 */
@CapacitorPlugin(name = "NativeVodPlayer")
public class NativeVodPlayerPlugin extends Plugin {

    @Nullable private ExoPlayer player;
    @Nullable private PlayerView playerView;
    @Nullable private ViewGroup host;
    private int webViewColor = Color.BLACK;
    private final Handler main = new Handler(Looper.getMainLooper());
    @Nullable private Runnable tick;
    private float lastVolume = 1f;
    private String lastResizeMode = "contain";

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url manquante");
            return;
        }
        double resumeAt = call.getDouble("resumeAt", 0d);
        String resizeMode = call.getString("resizeMode", lastResizeMode);
        if (resizeMode != null) lastResizeMode = resizeMode;

        getActivity().runOnUiThread(() -> {
            releaseInternal();
            attachSurface();
            applyResizeMode(lastResizeMode);

            ExoPlayer exo = new ExoPlayer.Builder(getContext()).build();
            exo.setAudioAttributes(
                    new AudioAttributes.Builder()
                            .setUsage(C.USAGE_MEDIA)
                            .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                            .build(),
                    true);
            exo.setHandleAudioBecomingNoisy(true);
            exo.setMediaItem(MediaItem.fromUri(url));
            if (resumeAt > 5) {
                exo.seekTo((long) (resumeAt * 1000));
            }
            exo.prepare();
            exo.play();
            player = exo;
            if (playerView != null) playerView.setPlayer(exo);

            exo.addListener(new Player.Listener() {
                @Override
                public void onPlaybackStateChanged(int state) {
                    if (state == Player.STATE_READY) {
                        JSObject ready = new JSObject();
                        ready.put("duration", Math.max(0, exo.getDuration()) / 1000.0);
                        notifyListeners("ready", ready);
                        startTick();
                    } else if (state == Player.STATE_BUFFERING) {
                        JSObject b = new JSObject();
                        b.put("value", true);
                        notifyListeners("buffering", b);
                    } else if (state == Player.STATE_ENDED) {
                        notifyListeners("ended", new JSObject());
                        stopTick();
                    }
                    if (state == Player.STATE_READY) {
                        JSObject b = new JSObject();
                        b.put("value", false);
                        notifyListeners("buffering", b);
                    }
                }

                @Override
                public void onIsPlayingChanged(boolean isPlaying) {
                    notifyListeners(isPlaying ? "playing" : "paused", new JSObject());
                }

                @Override
                public void onPlayerError(PlaybackException error) {
                    JSObject payload = new JSObject();
                    payload.put("kind", kindOf(error));
                    notifyListeners("error", payload);
                    stopTick();
                }
            });
        });

        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (player != null) player.pause();
        });
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (player != null) player.play();
        });
        call.resolve();
    }

    @PluginMethod
    public void seek(PluginCall call) {
        double seconds = call.getDouble("seconds", 0d);
        getActivity().runOnUiThread(() -> {
            if (player != null) player.seekTo(Math.max(0, (long) (seconds * 1000)));
        });
        call.resolve();
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        double value = call.getDouble("value", 100d);
        float vol = (float) Math.min(1, Math.max(0, value / 100.0));
        lastVolume = vol;
        getActivity().runOnUiThread(() -> {
            if (player != null) player.setVolume(vol);
        });
        call.resolve();
    }

    @PluginMethod
    public void setMuted(PluginCall call) {
        boolean muted = Boolean.TRUE.equals(call.getBoolean("value", false));
        getActivity().runOnUiThread(() -> {
            if (player != null) player.setVolume(muted ? 0f : lastVolume);
        });
        call.resolve();
    }

    @PluginMethod
    public void setResizeMode(PluginCall call) {
        String mode = call.getString("mode", lastResizeMode);
        if (mode != null) lastResizeMode = mode;
        getActivity().runOnUiThread(() -> applyResizeMode(lastResizeMode));
        call.resolve();
    }

    @PluginMethod
    public void release(PluginCall call) {
        getActivity().runOnUiThread(this::releaseInternal);
        call.resolve();
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        if (player != null) player.pause();
    }

    @Override
    protected void handleOnDestroy() {
        releaseInternal();
        super.handleOnDestroy();
    }

    private void attachSurface() {
        View web = getBridge().getWebView();
        if (web == null || web.getParent() == null) return;
        host = (ViewGroup) web.getParent();
        webViewColor = 0;
        web.setBackgroundColor(Color.TRANSPARENT);

        playerView = new PlayerView(getContext());
        playerView.setUseController(false);
        playerView.setBackgroundColor(Color.BLACK);
        playerView.setShutterBackgroundColor(Color.BLACK);
        playerView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        host.addView(playerView, 0);
        applyResizeMode(lastResizeMode);
    }

    private void applyResizeMode(String mode) {
        if (playerView == null) return;
        int resize = AspectRatioFrameLayout.RESIZE_MODE_FIT;
        if ("cover".equals(mode)) {
            resize = AspectRatioFrameLayout.RESIZE_MODE_ZOOM;
        } else if ("fill".equals(mode)) {
            resize = AspectRatioFrameLayout.RESIZE_MODE_FILL;
        }
        playerView.setResizeMode(resize);
        playerView.setBackgroundColor(Color.BLACK);
    }

    private void releaseInternal() {
        stopTick();
        if (player != null) {
            player.release();
            player = null;
        }
        if (playerView != null && host != null) {
            playerView.setPlayer(null);
            host.removeView(playerView);
            playerView = null;
        }
        View web = getBridge().getWebView();
        if (web != null) {
            web.setBackgroundColor(Color.BLACK);
        }
        host = null;
    }

    private void startTick() {
        stopTick();
        tick = new Runnable() {
            @Override
            public void run() {
                if (player == null) return;
                JSObject t = new JSObject();
                t.put("position", Math.max(0, player.getCurrentPosition()) / 1000.0);
                long d = player.getDuration();
                t.put("duration", d > 0 ? d / 1000.0 : 0);
                notifyListeners("time", t);
                main.postDelayed(this, 250);
            }
        };
        main.post(tick);
    }

    private void stopTick() {
        if (tick != null) {
            main.removeCallbacks(tick);
            tick = null;
        }
    }

    private static String kindOf(PlaybackException error) {
        int code = error.errorCode;
        if (code == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED
                || code == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT
                || code == PlaybackException.ERROR_CODE_IO_UNSPECIFIED) {
            return "network";
        }
        if (code == PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS
                || code == PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND) {
            return "notFound";
        }
        if (code == PlaybackException.ERROR_CODE_DECODER_INIT_FAILED
                || code == PlaybackException.ERROR_CODE_DECODING_FAILED
                || code == PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED
                || code == PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED) {
            return "decode";
        }
        return "unknown";
    }
}
