import ExpoModulesCore

// iOS, uygulamaların BLE "service data" yayınlamasına izin vermez. Bu yüzden kiosk tableti Android olmalıdır.
// Bu modül iOS'ta yalnızca "desteklenmiyor" yanıtı verir; öğrenci tarafındaki BLE TARAMASI iOS'ta sorunsuz çalışır.
public class KioskBeaconModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KioskBeacon")

    Function("isSupported") {
      return false
    }

    Function("getLastError") { () -> String? in
      return "IOS_NOT_SUPPORTED"
    }

    AsyncFunction("startAdvertising") { (_: String, _: String) -> Bool in
      return false
    }

    AsyncFunction("stopAdvertising") {
    }
  }
}
