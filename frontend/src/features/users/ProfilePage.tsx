import { useState } from 'react';
import type { PortalUser } from '../../api/types';
import { api, errorMessage } from '../../api/client';

export function ProfilePage({
  user,
  onUpdated,
  onSignedOut,
}: {
  user: PortalUser;
  onUpdated: (user: PortalUser) => void;
  onSignedOut: () => void;
}) {
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState('');
  return (
    <section className="page-enter">
      <div className="page-heading">
        <h1>Profil</h1>
      </div>
      <div className="page-body profile-layout">
        <form
          className="form-sheet"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setPending(true);
            try {
              const result = await api<{ user: PortalUser }>('/profile', 'PATCH', {
                name: data.get('name'),
              });
              onUpdated(result.user);
              setNotice('Profil güncellendi.');
            } catch (error) {
              setNotice(errorMessage(error));
            } finally {
              setPending(false);
            }
          }}
        >
          <h2>Hesap bilgileri</h2>
          <label htmlFor="profile-name">Ad soyad</label>
          <input id="profile-name" name="name" defaultValue={user.name} required maxLength={100} />
          <label htmlFor="profile-email">E-posta</label>
          <input id="profile-email" value={user.email} readOnly />
          <label htmlFor="profile-role">Rol</label>
          <input id="profile-role" value={user.roleLabel} readOnly />
          <p className="form-status" role="status">
            {notice}
          </p>
          <button className="primary-button" disabled={pending}>
            Kaydet
          </button>
        </form>
        <form
          className="form-sheet"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (data.get('password') !== data.get('repeat')) {
              setPasswordNotice('Şifreler eşleşmiyor.');
              return;
            }
            setPending(true);
            try {
              await api('/password', 'POST', {
                currentPassword: data.get('currentPassword'),
                password: data.get('password'),
              });
              onSignedOut();
            } catch (error) {
              setPasswordNotice(errorMessage(error));
            } finally {
              setPending(false);
            }
          }}
        >
          <h2>Şifre değiştir</h2>
          <label htmlFor="profile-current">Mevcut şifre</label>
          <input
            id="profile-current"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
          <label htmlFor="profile-password">Yeni şifre</label>
          <input
            id="profile-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
          <label htmlFor="profile-repeat">Yeni şifre tekrar</label>
          <input
            id="profile-repeat"
            name="repeat"
            type="password"
            autoComplete="new-password"
            required
            maxLength={128}
          />
          <p className="hint">Değişiklikten sonra yeniden giriş yapman gerekir.</p>
          <p className="form-status" role="alert">
            {passwordNotice}
          </p>
          <button className="primary-button" disabled={pending}>
            Şifreyi değiştir
          </button>
        </form>
      </div>
    </section>
  );
}
