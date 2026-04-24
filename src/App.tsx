// App.tsx részlet a return blokkból
return (
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <div className="app-wrapper">
      <header className="main-header">
        <h1 className="logo">Rezsiapp</h1>
        {user && (
          <div className="header-actions">
            <div className="user-info">
              <img src={user.picture} alt="Profil" />
              <button className="btn-logout" onClick={handleLogout}>Kilépés</button>
            </div>
          </div>
        )}
      </header>

      {!user ? (
        <section className="card login-card">
          <h2>Üdvözöljük a Rezsiappban!</h2>
          <p className="login-desc">
            Az alkalmazás használatához biztonságos Google-bejelentkezés szükséges. 
            Adataidat védett módon, a saját fiókodhoz kötve tároljuk.
          </p>
          <div className="google-btn-container">
            <GoogleLogin 
              onSuccess={handleLoginSuccess} 
              onError={() => alert('Hiba a bejelentkezés során')} 
            />
          </div>
        </section>
      ) : (
        <>
          {/* MEGOSZTÁS - Most már kisebb és balra rendezett */}
          <div className="top-row">
            <section className="card share-card compact">
              <div className="view-selector">
                <select value={viewingUserId || ''} onChange={(e) => handleUserChange(e.target.value)}>
                  <option value={user.sub}>Saját adataim</option>
                  {sharedWithMe.map((s: any) => (
                    <option key={s.owner_id} value={s.owner_id}>🏠 {s.owner_email}</option>
                  ))}
                </select>
              </div>
              
              {viewingUserId === user.sub && (
                <div className="share-input-group">
                  <input 
                    type="email" 
                    placeholder="Megosztás (email)..." 
                    value={shareEmail} 
                    onChange={(e) => setShareEmail(e.target.value)} 
                  />
                  <button className="btn-share" onClick={handleShare}>+</button>
                </div>
              )}
            </section>
          </div>

          {/* Innentől a többi kód változatlan (main-card, controls, chart, list) */}
          {/* ... */}
        </>
      )}
    </div>
  </GoogleOAuthProvider>
);
