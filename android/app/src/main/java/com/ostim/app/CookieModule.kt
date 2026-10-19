package com.ostim.app

import android.webkit.CookieManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class CookieModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "SystemCookieManager"

    @ReactMethod
    fun getCookies(url: String, promise: Promise) {
        try {
            val cookieManager = CookieManager.getInstance()
            val cookies = cookieManager.getCookie(url)
            promise.resolve(cookies ?: "")
        } catch (e: Exception) {
            promise.reject("COOKIE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun clearCookies(promise: Promise) {
        try {
            val cookieManager = CookieManager.getInstance()
            cookieManager.removeAllCookies { value ->
                promise.resolve(value)
            }
        } catch (e: Exception) {
            promise.reject("COOKIE_ERROR", e.message)
        }
    }
}
