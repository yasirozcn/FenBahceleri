"use client";

export default function DeleteKioskButton({ name }: { name: string }) {
  return (
    <button
      className="btn btn-danger"
      onClick={(e) => {
        if (!window.confirm(`"${name}" kiosku kalıcı olarak silinsin mi? Geçmiş kayıtlar korunur, ancak bu kiosk geri getirilemez.`)) e.preventDefault();
      }}
    >
      Sil
    </button>
  );
}
