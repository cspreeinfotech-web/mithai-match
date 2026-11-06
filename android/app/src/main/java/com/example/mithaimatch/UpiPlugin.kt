package com.example.mithaimatch

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

// Launches a upi:// intent, letting the user pick (or auto-picking, if only one app resolves)
// a UPI app, and hands back whatever string that app returns in its result.
//
// Why not trust queryIntentActivities() to say "no UPI app installed": several OEM ROMs
// (MIUI, ColorOS, Vivo) return an empty list here even when GPay/PhonePe are installed and
// perfectly launchable — so NO_UPI_APP is only ever reported from the real signal, the
// launch itself throwing ActivityNotFoundException.
@CapacitorPlugin(name = "Upi")
class UpiPlugin : Plugin() {
    @Volatile
    private var paymentInProgress = false

    @PluginMethod
    fun startUpi(call: PluginCall) {
        val uri = call.getString("uri")
        if (uri == null) {
            call.reject("MISSING_URI")
            return
        }
        if (paymentInProgress) {
            call.reject("BUSY")
            return
        }

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
        val resolved = activity.packageManager.queryIntentActivities(intent, 0)
        val launchIntent = if (resolved.size == 1) intent else Intent.createChooser(intent, "Pay with")

        paymentInProgress = true
        try {
            startActivityForResult(call, launchIntent, "handleUpiResult")
        } catch (e: ActivityNotFoundException) {
            paymentInProgress = false
            call.reject("NO_UPI_APP")
        }
    }

    @ActivityCallback
    private fun handleUpiResult(call: PluginCall?, result: ActivityResult) {
        paymentInProgress = false
        if (call == null) return
        // Not using result.resultCode: some UPI apps return RESULT_CANCELED even on a
        // completed payment, so the raw response string (parsed server-side by
        // report_payment_result) is the only signal worth trusting.
        val data = result.data
        val response = data?.getStringExtra("response")
            ?: data?.extras?.keySet()?.joinToString("&") { key -> "$key=${data.extras?.get(key)}" }
            ?: ""
        call.resolve(JSObject().put("response", response))
    }
}
