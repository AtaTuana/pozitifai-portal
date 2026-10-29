import { useEffect, useState } from 'react';
import type { Plan, PortalUser, Role } from '../../api/types';
import { api, errorMessage } from '../../api/client';
import { Dialog } from '../../components/ui/Dialog';
import { Icon } from '../../components/ui/Icon';

export function UsersPage({
  plan,
  currentUser,
  onSelfChanged,
}: {
  plan: Plan;
  currentUser: PortalUser;
  onSelfChanged: () => void;
}) {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<PortalUser | 'new' | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      setUsers((await api<{ users: PortalUser[] }>('/users')).users);
      setError('');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    api<{ users: PortalUser[] }>('/users')
      .then((result) => {
        if (active) setUsers(result.users);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="page-enter">
      <div className="page-heading">
        <h1>Kullanıcılar</h1>
        <button className="primary-button" onClick={() => setEditing('new')}>
          <Icon name="plus" />
          Kullanıcı oluştur
        </button>
      </div>
      <div className="page-body">
        <p className="form-status" role="status">
          {error || (loading ? 'Kullanıcılar yükleniyor…' : '')}
        </p>
        <div className="table-sheet">
          <table>
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Rol</th>
                <th>Kapsam</th>
                <th>Durum</th>
                <th>Oluşturulma</th>
                <th>
                  <span className="sr-only">İşlem</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </td>
                  <td>{user.roleLabel}</td>
                  <td>
                    {user.teamId
                      ? plan.nodes.find((node) => node.kind === 'team' && node.code === user.teamId)
                          ?.name || 'Atanan takım'
                      : 'Tüm takımlar'}
                  </td>
                  <td>{user.active ? 'Etkin' : 'Kapalı'}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <button
                      className="outline-button"
                      onClick={() => setEditing(user)}
                      aria-label={`${user.name} kullanıcısını düzenle`}
                    >
                      Düzenle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && (
        <UserEditor
          user={editing === 'new' ? null : editing}
          plan={plan}
          onClose={() => setEditing(null)}
          onSaved={async (saved) => {
            setEditing(null);
            if (saved.id === currentUser.id) onSelfChanged();
            else await load();
          }}
        />
      )}
    </section>
  );
}

function UserEditor({
  user,
  plan,
  onClose,
  onSaved,
}: {
  user: PortalUser | null;
  plan: Plan;
  onClose: () => void;
  onSaved: (user: PortalUser) => void;
}) {
  const [role, setRole] = useState<Role>(user?.role || 'manager');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      title={user ? 'Kullanıcıyı düzenle' : 'Kullanıcı oluştur'}
      onClose={onClose}
      busy={pending}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          const data = new FormData(event.currentTarget);
          setError('');
          if (!user && data.get('password') !== data.get('repeat')) {
            setError('Şifreler eşleşmiyor.');
            return;
          }
          setPending(true);
          try {
            const result = await api<{ user: PortalUser }>(
              user ? `/users/${user.id}` : '/users',
              user ? 'PATCH' : 'POST',
              {
                name: data.get('name'),
                email: data.get('email'),
                role,
                teamId: role === 'captain' ? data.get('teamId') : null,
                active: user?.role === 'admin' ? true : data.get('active') === 'on',
                currentPassword: data.get('currentPassword'),
                ...(!user ? { password: data.get('password') } : {}),
              },
            );
            onSaved(result.user);
          } catch (reason) {
            setError(errorMessage(reason));
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending} className="unframed">
          <label htmlFor="user-name">Ad soyad</label>
          <input
            id="user-name"
            name="name"
            defaultValue={user?.name}
            required
            maxLength={150}
            autoFocus
          />
          <label htmlFor="user-email">E-posta</label>
          <input
            id="user-email"
            name="email"
            type="email"
            defaultValue={user?.email}
            required
            maxLength={254}
            autoComplete="off"
          />
          <label htmlFor="user-role">Rol</label>
          <select
            id="user-role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            disabled={user?.role === 'admin'}
          >
            {user?.role === 'admin' && <option value="admin">Admin</option>}
            <option value="manager">Yönetici</option>
            <option value="captain">Takım kaptanı</option>
          </select>
          {role === 'captain' ? (
            <>
              <label htmlFor="user-team">Takım</label>
              <select id="user-team" name="teamId" defaultValue={user?.teamId || ''} required>
                <option value="">Takım seç</option>
                {plan.nodes
                  .filter((node) => node.kind === 'team')
                  .map((team) => (
                    <option key={team.id} value={team.code}>
                      {team.name}
                    </option>
                  ))}
              </select>
            </>
          ) : (
            <p className="hint">Tüm takımların verilerini görebilir.</p>
          )}
          {!user && (
            <>
              <label htmlFor="user-password">İlk şifre</label>
              <input
                id="user-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
              <label htmlFor="user-repeat">Şifre tekrar</label>
              <input
                id="user-repeat"
                name="repeat"
                type="password"
                autoComplete="new-password"
                required
                maxLength={128}
              />
            </>
          )}
          {user?.role !== 'admin' && (
            <label className="check-row">
              <input type="checkbox" name="active" defaultChecked={user?.active ?? true} />
              <span>Hesap etkin</span>
            </label>
          )}
          <label htmlFor="actor-password">Onay için kendi şifren</label>
          <input
            id="actor-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
          <p className="hint">
            Yetki veya hesap durumu değişince kullanıcının açık oturumları geçersizleşir.
          </p>
        </fieldset>
        <p className="form-status" role="alert">
          {error}
        </p>
        <div className="form-actions">
          <button type="button" className="text-button" onClick={onClose} disabled={pending}>
            Vazgeç
          </button>
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
