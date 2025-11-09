
import Header from './Header';
import Footer from './Footer';
import PhotoIdeas from './PhotoIdeas';

function App() {
  

  return (
    <div>
      <Header
        title="Rezsi nyilvántartó app"
        subtitle="Áram, víz, gáz fogyasztás követése"
      />

      <main style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Aktuális napi adatok bevitele</h2>
        
      </main>
      <PhotoIdeas />
      <Footer />
    </div>
  );
}

export default App;



