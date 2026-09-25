package com.novatv.player;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayerImmersivePlugin.class);
        registerPlugin(NativeVodPlayerPlugin.class);
        super.onCreate(savedInstanceState);
        // Certains portails fournissent encore leurs logos en HTTP alors
        // que l'interface Capacitor est chargée en HTTPS. Sans ce réglage,
        // Android bloque ces images malgré l'autorisation cleartext réseau.
        getBridge().getWebView().getSettings().setMixedContentMode(
                WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        );

        // Le bouton Retour Android suit l'historique de la WebView, donc le
        // même historique que les navigations Next.js de l'application.
        // S'il n'y a plus de page précédente, Android reprend son comportement
        // normal et peut fermer l'activité.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge().getWebView();
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                    return;
                }

                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
            }
        });

        PlayerImmersivePlugin.hideNavigationBar(getWindow());
    }

    @Override
    public void onResume() {
        super.onResume();
        // Android peut réafficher la barre après un changement de fenêtre,
        // une reprise ou un geste système. On réapplique le mode masqué à
        // la reprise, tout en conservant l'apparition transitoire par swipe.
        PlayerImmersivePlugin.hideNavigationBar(getWindow());
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            PlayerImmersivePlugin.hideNavigationBar(getWindow());
        }
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
