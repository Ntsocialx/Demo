import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function WelcomePage() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) return router.push('/');

      const res = await fetch('http://localhost:5000/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        localStorage.removeItem('token');
        router.push('/');
      }
    };
    fetchUser();
  }, [router]);

  if (!user) return <div className="p-10 text-center">Loading session...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white p-4 border-b flex justify-between items-center px-10">
        <span className="font-bold text-indigo-600 text-xl">Demo Dashboard</span>
        <button 
          onClick={() => { localStorage.removeItem('token'); router.push('/'); }}
          className="text-red-500 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition"
        >Logout</button>
      </nav>
      <main className="p-10 max-w-4xl mx-auto">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-3xl font-bold">
            {user.fullName[0]}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Welcome, {user.fullName}</h1>
            <p className="text-slate-500">{user.email}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
