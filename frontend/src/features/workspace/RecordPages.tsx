import { useEffect, useState } from "react";
import type { Plan } from "../../api/types";
import { api, errorMessage } from "../../api/client";
import { RosterImport } from "../imports/RosterImport";

export function AgentsPage({
  plan,
  canManage,
  onImported,
}: {
  plan: Plan;
  canManage: boolean;
  onImported: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const agents = plan.nodes.filter(
    (node) =>
      node.kind === "agent" &&
      `${node.name} ${node.code}`
        .toLocaleLowerCase("tr")
        .includes(search.toLocaleLowerCase("tr")),
  );
  return (
    <section className="page-enter">
      <div className="page-heading">
        <h1>Temsilciler</h1>
        <div className="search-field">
          <label className="sr-only" htmlFor="agent-search">
            Temsilci ara
          </label>
          <input
            id="agent-search"
            placeholder="Ad veya kod ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <div className="page-body">
        {canManage && <RosterImport onImported={onImported} />}
        <div className="table-sheet">
          <table>
            <thead>
              <tr>
                <th>Temsilci</th>
                <th>Kod</th>
                <th>Takım</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const teamId = plan.edges.find(
                  (edge) => edge.target === agent.id,
                )?.source;
                return (
                  <tr key={agent.id}>
                    <td>{agent.name}</td>
                    <td>{agent.code}</td>
                    <td>
                      {plan.nodes.find((node) => node.id === teamId)?.name ||
                        "Atanmamış"}
                    </td>
                  </tr>
                );
              })}
              {!agents.length && (
                <tr>
                  <td colSpan={3} className="empty-cell">
                    Temsilci bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

type Activity = {
  id: number;
  action: string;
  target: string;
  actor: string;
  createdAt: string;
};
const actionLabels: Record<string, string> = {
  "admin.created": "Admin oluşturuldu",
  "login.success": "Giriş yapıldı",
  "login.failed": "Başarısız giriş",
  "login.limited": "Giriş sınırı",
  logout: "Çıkış yapıldı",
  "planning.view": "Plan görüntülendi",
  "planning.saved": "Plan kaydedildi",
  "users.view": "Kullanıcılar görüntülendi",
  "user.created": "Kullanıcı oluşturuldu",
  "user.updated": "Kullanıcı güncellendi",
  "profile.updated": "Profil güncellendi",
  "password.changed": "Şifre değiştirildi",
  "access.denied": "Erişim reddedildi",
  "reauth.failed": "Şifre doğrulanamadı",
  "import.completed": "Dosya işlendi",
  "import.failed": "Dosya işlenemedi",
  "import.repeated": "Daha önce işlenmiş dosya yeniden gönderildi",
  "import.results_repaired": "Boş çağrı sonuçları kaynaktan onarıldı",
};
export function ActivityPage() {
  const [events, setEvents] = useState<Activity[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<{ events: Activity[] }>("/activity")
      .then((data) => {
        if (active) setEvents(data.events);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="page-enter">
      <div className="page-heading">
        <h1>İşlem geçmişi</h1>
        <span className="muted">Son 200 işlem</span>
      </div>
      <div className="page-body">
        <p role="status">{error}</p>
        <div className="table-sheet">
          <table>
            <thead>
              <tr>
                <th>İşlem</th>
                <th>Kullanıcı</th>
                <th>Zaman</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{actionLabels[event.action] || event.action}</td>
                  <td>{event.actor}</td>
                  <td>{new Date(event.createdAt).toLocaleString("tr-TR")}</td>
                </tr>
              ))}
              {!events.length && (
                <tr>
                  <td colSpan={3} className="empty-cell">
                    Henüz işlem kaydı yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function OverviewPage({ campaignName }: { campaignName: string }) {
  return (
    <section className="page-enter">
      <div className="page-heading">
        <h1>Genel bakış</h1>
        <span className="muted">{campaignName}</span>
      </div>
      <div className="overview-empty">
        <p>Rapor görünümü henüz hazır değil.</p>
      </div>
    </section>
  );
}
