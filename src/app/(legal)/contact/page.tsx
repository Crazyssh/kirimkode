import { Card, CardContent } from "@/components/ui/card";
import { Mail, MessageSquare, Clock, MapPin } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
          Hubungi Kami
        </h1>
        <p className="text-muted">
          Punya pertanyaan, saran, atau butuh bantuan? Tim kami siap membantu Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <Mail className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Email Support</h3>
            <p className="text-sm text-muted mb-2">Untuk bantuan teknis dan pertanyaan umum</p>
            <a href="mailto:support@kirimkode.com" className="text-sm text-primary hover:underline">
              support@kirimkode.com
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <MessageSquare className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-semibold mb-1">WhatsApp</h3>
            <p className="text-sm text-muted mb-2">Respon cepat via chat WhatsApp</p>
            <a href="https://wa.me/6281234567890" className="text-sm text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              +62 812-3456-7890
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Clock className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Jam Operasional</h3>
            <p className="text-sm text-muted mb-1">Senin - Jumat: 09:00 - 21:00 WIB</p>
            <p className="text-sm text-muted">Sabtu - Minggu: 10:00 - 18:00 WIB</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <MapPin className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Lokasi</h3>
            <p className="text-sm text-muted">
              Jakarta, Indonesia
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold font-[family-name:var(--font-space-grotesk)]">FAQ Cepat</h2>
        <div className="space-y-3">
          {[
            { q: "Saldo saya tidak masuk setelah deposit", a: "Tunggu 1-5 menit. Jika belum masuk, hubungi support dengan bukti pembayaran." },
            { q: "OTP tidak masuk padahal nomor sudah aktif", a: "Coba batalkan dan beli nomor baru. Saldo otomatis dikembalikan jika OTP tidak masuk dalam 20 menit." },
            { q: "Akun saya diblokir", a: "Hubungi support via email dengan menjelaskan situasinya. Tim kami akan meninjau kasus Anda." },
          ].map((faq) => (
            <div key={faq.q} className="p-4 rounded-xl bg-surface border border-border">
              <h4 className="text-sm font-semibold mb-1">{faq.q}</h4>
              <p className="text-xs text-muted">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 rounded-xl bg-primary/5 border border-primary/20 text-center">
        <h3 className="font-bold mb-2">Butuh Kerjasama Bisnis?</h3>
        <p className="text-sm text-muted mb-3">
          Untuk kerjasama bisnis, reseller, atau kebutuhan enterprise, hubungi kami di:
        </p>
        <a href="mailto:business@kirimkode.com" className="text-primary font-medium hover:underline">
          business@kirimkode.com
        </a>
      </div>
    </div>
  );
}
