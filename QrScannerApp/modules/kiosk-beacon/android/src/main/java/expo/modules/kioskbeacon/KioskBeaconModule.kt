package expo.modules.kioskbeacon

import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.os.ParcelUuid
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Kiosk tabletinin BLE yayını.
 * Okul uygulamasına özel servis kimliği altında 8 baytlık, 5 saniyede bir değişen jetonu
 * "service data" olarak yayınlar. Öğrenci telefonu bu jetonu duyarak kioskun yanında olduğunu kanıtlar.
 */
class KioskBeaconModule : Module() {
  private var callback: AdvertiseCallback? = null
  private var lastError: String? = null

  override fun definition() = ModuleDefinition {
    Name("KioskBeacon")

    Function("isSupported") {
      advertiser() != null
    }

    Function("getLastError") {
      lastError
    }

    AsyncFunction("startAdvertising") { serviceUuid: String, tokenHex: String ->
      start(serviceUuid, tokenHex)
    }

    AsyncFunction("stopAdvertising") {
      stop()
    }

    OnDestroy {
      stop()
    }
  }

  private fun advertiser(): BluetoothLeAdvertiser? {
    val ctx = appContext.reactContext ?: return null
    val manager = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return null
    val adapter = manager.adapter ?: return null
    if (!adapter.isEnabled) return null
    return adapter.bluetoothLeAdvertiser
  }

  @SuppressLint("MissingPermission")
  private fun start(serviceUuid: String, tokenHex: String): Boolean {
    val adv = advertiser() ?: throw BeaconException("Bluetooth kapalı veya bu cihaz BLE yayını desteklemiyor.")
    stop()
    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
      .setConnectable(false)
      .setTimeout(0)
      .build()
    // 31 baytlık sınıra sığması için cihaz adı ve güç seviyesi eklenmez.
    val data = AdvertiseData.Builder()
      .setIncludeDeviceName(false)
      .setIncludeTxPowerLevel(false)
      .addServiceData(ParcelUuid.fromString(serviceUuid), hexToBytes(tokenHex))
      .build()
    val cb = object : AdvertiseCallback() {
      override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
        lastError = null
      }

      override fun onStartFailure(errorCode: Int) {
        lastError = "ADVERTISE_FAILED_$errorCode"
      }
    }
    adv.startAdvertising(settings, data, cb)
    callback = cb
    return true
  }

  @SuppressLint("MissingPermission")
  private fun stop() {
    val cb = callback ?: return
    try {
      advertiser()?.stopAdvertising(cb)
    } catch (_: Exception) {
    }
    callback = null
  }

  private fun hexToBytes(hex: String): ByteArray {
    require(hex.length % 2 == 0) { "Geçersiz jeton" }
    return ByteArray(hex.length / 2) { i -> hex.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
  }
}

class BeaconException(message: String) : CodedException(message)
