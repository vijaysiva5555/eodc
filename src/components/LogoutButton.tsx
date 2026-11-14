'use client';
export default function LogoutButton() {
  return <button className="link" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/'; }}>Log out</button>;
}
