-- ============================================================
--  BookHouse — Schema SQL untuk Supabase
--  Jalankan file ini di Supabase > SQL Editor
-- ============================================================

-- 1. TABEL CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  description TEXT,
  color      TEXT DEFAULT '#6366f1',
  icon       TEXT DEFAULT '📂',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABEL BOOKS
CREATE TABLE IF NOT EXISTS books (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  author      TEXT NOT NULL,
  category    TEXT NOT NULL,
  year        INT,
  stock       INT DEFAULT 0,
  publisher   TEXT,
  rating      INT DEFAULT 4,
  color       TEXT,
  cover_url   TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL PROFILES (data tambahan user, terhubung ke auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  phone      TEXT,
  address    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL BORROWS
CREATE TABLE IF NOT EXISTS borrows (
  id              BIGSERIAL PRIMARY KEY,
  ticket_number   TEXT NOT NULL UNIQUE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id         BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  borrower_name   TEXT NOT NULL,
  borrower_id_num TEXT,
  borrower_phone  TEXT,
  borrow_date     TIMESTAMPTZ DEFAULT NOW(),
  deadline        TIMESTAMPTZ NOT NULL,
  duration        INT DEFAULT 7,
  notes           TEXT,
  photo_url       TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','returned')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL FAVOURITES
CREATE TABLE IF NOT EXISTS favourites (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id    BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE books      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrows    ENABLE ROW LEVEL SECURITY;
ALTER TABLE favourites ENABLE ROW LEVEL SECURITY;

-- Books & Categories: semua bisa baca dan tulis (untuk demo)
CREATE POLICY "books_all"      ON books      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "categories_all" ON categories FOR ALL USING (true) WITH CHECK (true);

-- Profiles
CREATE POLICY "profiles_all"   ON profiles   FOR ALL USING (true) WITH CHECK (true);

-- Borrows: semua bisa baca (admin perlu), user hanya bisa insert miliknya
CREATE POLICY "borrows_select" ON borrows FOR SELECT USING (true);
CREATE POLICY "borrows_insert" ON borrows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "borrows_update" ON borrows FOR UPDATE USING (true) WITH CHECK (true);

-- Favourites: user hanya akses miliknya
CREATE POLICY "favs_all" ON favourites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
--  STORAGE BUCKET untuk foto KTP
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('id-photos', 'id-photos', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "id_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'id-photos');

CREATE POLICY "id_photos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'id-photos');

-- ============================================================
--  DATA AWAL (Seed Data)
-- ============================================================

INSERT INTO categories (name, description, color, icon) VALUES
  ('Fiksi',     'Novel, cerita pendek, dan karya fiksi lainnya.', '#f43f5e', '📕'),
  ('Sains',     'Buku-buku ilmu pengetahuan alam dan terapan.',   '#10b981', '🔬'),
  ('Bisnis',    'Kewirausahaan, manajemen, dan keuangan.',         '#f97316', '💼'),
  ('Psikologi', 'Ilmu jiwa dan perilaku manusia.',                 '#8b5cf6', '🧠'),
  ('Sejarah',   'Sejarah dunia dan peradaban manusia.',            '#fbbf24', '🏛️'),
  ('Teknologi', 'Pemrograman, IT, dan teknologi terkini.',         '#3b82f6', '💻'),
  ('Filsafat',  'Pemikiran dan filsafat kehidupan.',               '#14b8a6', '🧿')
ON CONFLICT (name) DO NOTHING;

INSERT INTO books (title, author, category, year, stock, publisher, rating, color, cover_url, description) VALUES
  ('The Psychology of Money',  'Morgan Housel',            'Psikologi', 2020, 8,  'Harriman House',            5, 'linear-gradient(135deg,#6366f1,#8b5cf6)', 'https://covers.openlibrary.org/b/isbn/9780857197689-L.jpg', 'Buku ini menghadirkan 19 pelajaran berharga tentang bagaimana cara orang berpikir tentang uang.'),
  ('Atomic Habits',            'James Clear',              'Bisnis',    2018, 5,  'Avery',                     5, 'linear-gradient(135deg,#f97316,#dc2626)', 'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg', 'James Clear membuktikan bahwa perubahan besar dimulai dari kebiasaan kecil.'),
  ('A Brief History of Time',  'Stephen Hawking',          'Sains',     1988, 3,  'Bantam Books',              4, 'linear-gradient(135deg,#10b981,#0891b2)', 'https://covers.openlibrary.org/b/isbn/9780553380163-L.jpg', 'Stephen Hawking membawa pembaca awam menyelami misteri alam semesta.'),
  ('The Midnight Library',     'Matt Haig',                'Fiksi',     2020, 12, 'Canongate Books',           5, 'linear-gradient(135deg,#f43f5e,#9333ea)', 'https://covers.openlibrary.org/b/isbn/9780525559474-L.jpg', 'Nora Seed menemukan sebuah perpustakaan ajaib yang terletak di antara hidup dan mati.'),
  ('Sapiens',                  'Yuval Noah Harari',        'Sejarah',   2011, 6,  'Harper Perennial',          5, 'linear-gradient(135deg,#fbbf24,#f97316)', 'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg', 'Harari menelusuri perjalanan panjang umat manusia dari Homo sapiens pertama di Afrika.'),
  ('Rich Dad Poor Dad',        'Robert T. Kiyosaki',       'Bisnis',    1997, 9,  'Warner Books',              4, 'linear-gradient(135deg,#0ea5e9,#6366f1)', 'https://covers.openlibrary.org/b/isbn/9781612680194-L.jpg', 'Kiyosaki membandingkan pola pikir dua ayah tentang keuangan.'),
  ('The Great Gatsby',         'F. Scott Fitzgerald',      'Fiksi',     1925, 7,  'Scribner',                  4, 'linear-gradient(135deg,#8b5cf6,#3b82f6)', 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg', 'Kisah Jay Gatsby yang misterius dan obsesinya terhadap Daisy Buchanan.'),
  ('Clean Code',               'Robert C. Martin',         'Teknologi', 2008, 4,  'Prentice Hall',             5, 'linear-gradient(135deg,#14b8a6,#6366f1)', 'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg', 'Panduan wajib bagi setiap programmer profesional.'),
  ('Thinking, Fast and Slow',  'Daniel Kahneman',          'Psikologi', 2011, 6,  'Farrar, Straus and Giroux', 5, 'linear-gradient(135deg,#ec4899,#8b5cf6)', 'https://covers.openlibrary.org/b/isbn/9780374533557-L.jpg', 'Mengungkap dua sistem berpikir manusia: cepat dan lambat.'),
  ('Meditations',              'Marcus Aurelius',          'Filsafat',  180,  10, 'Penguin Classics',          5, 'linear-gradient(135deg,#f59e0b,#ef4444)', 'https://covers.openlibrary.org/b/isbn/9780140449334-L.jpg', 'Catatan harian refleksi diri dari Kaisar Romawi Marcus Aurelius.'),
  ('The Pragmatic Programmer', 'Andrew Hunt & David Thomas','Teknologi',1999, 3,  'Addison-Wesley',            4, 'linear-gradient(135deg,#22c55e,#14b8a6)', 'https://covers.openlibrary.org/b/isbn/9780135957059-L.jpg', 'Tips dan filosofi pragmatis untuk menjadi programmer lebih baik.'),
  ('Homo Deus',                'Yuval Noah Harari',        'Sejarah',   2015, 5,  'Harper Perennial',          4, 'linear-gradient(135deg,#f97316,#8b5cf6)', 'https://covers.openlibrary.org/b/isbn/9780062464316-L.jpg', 'Harari menatap masa depan umat manusia di era kecerdasan buatan.')
ON CONFLICT DO NOTHING;
