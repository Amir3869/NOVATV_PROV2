package com.novatv.player;

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
}
