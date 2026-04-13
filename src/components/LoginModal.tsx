import { useState } from 'react';
import { useTournament } from '@/context/TournamentContext';

export function LoginModal() {
  const { ui, doLogin, setShowLogin } = useTournament();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  if (!ui.showLogin) return null;

  return (
    <div className="login-backdrop">
      <div className="login">
        <h2>Acesso admin</h2>
        <p>Para editar localmente, use o mesmo login da versão anterior.</p>
        <div className="stack">
          <div className="field">
            <label className="label">Usuário</label>
            <input className="input" placeholder="arbitro" value={user} onChange={e => setUser(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Senha</label>
            <input type="password" className="input" placeholder="arbitragem" value={pass} onChange={e => setPass(e.target.value)} />
          </div>
          {ui.loginError && <div className="error">{ui.loginError}</div>}
          <button className="btn" onClick={() => doLogin(user, pass)}>Entrar</button>
          <button className="btn secondary" onClick={() => setShowLogin(false)}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
