package com.novatv.player;

import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayerImmersivePlugin.class);
        registerPlugin(NativeVodPlayerPlugin.class);
        super.onCreate(savedInstanceState);
        PlayerImmersivePlugin.hideNavigationBar(getWindow());
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        // Android 12+ utilise setAutoEnterEnabled. Pour Android 8–11,
        // on déclenche le PiP explicitement au départ vers l'accueil.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            NativeVodPlayerPlugin.enterFromSystem();
        }
    }
}
