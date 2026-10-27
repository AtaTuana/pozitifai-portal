import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { errorMessage } from '../../api/client';

type Props = {
  onLogin: (email: string, password: string) => Promise<void>;
  error: string;
  needsSetup: boolean;
  loading: boolean;
  onRetry: () => void;
};

/** Reference login proportions, with accessible labels and password-manager support. */
export function LoginPage({ onLogin, error, needsSetup, loading, onRetry }: Props) {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <main className="login-main" id="login-main">
      <section className="login-sheet" aria-labelledby="login-title">
        <div className="login-intro">
          <h1 id="login-title">
            Çalışma alanına
            <br />
            hoş geldin.
          </h1>
        </div>
        <form
          aria-busy={pending || loading}
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending || loading) return;
            const form = event.currentTarget;
            const data = new FormData(form);
            setPending(true);
            setMessage('');
            try {
              await onLogin(String(data.get('email')), String(data.get('password')));
            } catch (reason) {
              setMessage(errorMessage(reason));
            } finally {
              const password = form.elements.namedItem('password') as HTMLInputElement;
              if (password) password.value = '';
              setPending(false);
            }
          }}
        >
          <label htmlFor="login-email">E-posta</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            placeholder="ad@firma.com"
            autoCapitalize="none"
            spellCheck={false}
            disabled={pending}
          />
          <label htmlFor="login-password">Şifre</label>
          <div className="password-field">
            <input
              id="login-password"
              name="password"
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              required
              maxLength={128}
              disabled={pending}
            />
            <button
              type="button"
              onClick={() => setVisible(!visible)}
              aria-pressed={visible}
              aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              {visible ? 'Gizle' : 'Göster'}
            </button>
          </div>
          <p className="form-status" role="status">
            {message ||
              error ||
              (needsSetup
                ? 'İlk admin hesabını start.bat penceresinden oluştur.'
                : loading
                  ? 'Bağlantı kuruluyor…'
                  : '')}
          </p>
          <button
            type="submit"
            className="login-submit"
            disabled={pending || loading || needsSetup}
          >
            {pending ? 'Giriş yapılıyor…' : 'Giriş yap'}
            <Icon name="arrow" />
          </button>
          {error && (
            <button type="button" className="text-button" onClick={onRetry}>
              Bağlantıyı yeniden dene
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
