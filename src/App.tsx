import { useState } from 'react';
import Header from './Header';
import Footer from './Footer';
import PhotoIdeas from './PhotoIdeas';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <Header
        title="React tanuló playground 🎓"
        subtitle="Komponensek + props + state – lépésről lépésre"
      />

      <main style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Üdv a React világában 👋</h2>
        <p>Ez az első komponens-alapú oldalam.</p>

        <h3>Számláló: {count}</h3>
        <button
          onClick={() => setCount(count + 1)}
          style={{
            fontSize: '1.2rem',
            padding: '10px 20px',
            cursor: 'pointer',
            borderRadius: '10px',
          }}
        >
          +1
        </button>
      </main>
      <PhotoIdeas />
      <Footer />
    </div>
  );
}

export default App;



