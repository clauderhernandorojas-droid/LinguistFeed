import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

void main() {
  runApp(const ProviderScope(child: LinguistFeedApp()));
}

// --- MODELOS DE DATOS ---
class VocabularyItem {
  final String word, definition, example;
  VocabularyItem({required this.word, required this.definition, required this.example});
}

class ReadingArticle {
  final String title, category, level, content;
  final List<VocabularyItem> vocabulary;
  ReadingArticle({
    required this.title, 
    required this.category, 
    required this.level, 
    required this.content, 
    this.vocabulary = const []
  });
}

// --- DATOS DE PRUEBA (MOCK DATA) ---
final List<ReadingArticle> mockArticles = [
  ReadingArticle(title: "The Future of Mars Exploration", category: "Ciencia", level: "B1", content: "Scientists are planning new missions to the red planet..."),
  ReadingArticle(title: "New AI Developments in 2026", category: "Tecnología", level: "B2", content: "Artificial Intelligence continues to evolve rapidly..."),
  ReadingArticle(title: "World Cup Finals Highlights", category: "Deportes", level: "A2", content: "The match was intense from the very first minute..."),
  ReadingArticle(title: "The Secrets of Ancient Egypt", category: "Historia", level: "B1", content: "New pyramids have been discovered using satellite technology..."),
  ReadingArticle(title: "Electric Cars: A Green Revolution", category: "Tecnología", level: "A2", content: "More people are switching to electric vehicles every year..."),
  ReadingArticle(title: "Healthy Habits for Busy Teachers", category: "Salud", level: "B1", content: "Maintaining a balance between work and life is essential..."),
];

// --- NAVEGACIÓN ---
final _router = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(path: '/', builder: (context, state) => const LoginScreen()),
    GoRoute(
      path: '/student', 
      builder: (context, state) => const StudentFeedScreen()
    ),
    GoRoute(
      path: '/daily-reading',
      builder: (context, state) {
        final article = state.extra as ReadingArticle;
        return DailyReadingScreen(article: article);
      },
    ),
  ],
);

class LinguistFeedApp extends StatelessWidget {
  const LinguistFeedApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'LinguistFeed',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        useMaterial3: true,
      ),
      routerConfig: _router,
      debugShowCheckedModeBanner: false,
    );
  }
}

// --- PANTALLA DE LOGIN ---
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.auto_stories, size: 80, color: Colors.indigo),
            const SizedBox(height: 20),
            const Text("LinguistFeed", style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold)),
            const SizedBox(height: 40),
            ElevatedButton(
              onPressed: () => context.go('/student'), 
              style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 50, vertical: 15)),
              child: const Text('Entrar como Estudiante'),
            ),
          ],
        ),
      ),
    );
  }
}

// --- FEED DEL ESTUDIANTE (CON TARJETAS Y FILTROS) ---
class StudentFeedScreen extends StatefulWidget {
  const StudentFeedScreen({super.key});
  @override
  State<StudentFeedScreen> createState() => _StudentFeedScreenState();
}

class _StudentFeedScreenState extends State<StudentFeedScreen> {
  String selectedCategory = 'Todos';
  final List<String> categories = ['Todos', 'Ciencia', 'Tecnología', 'Deportes', 'Historia', 'Salud'];

  @override
  Widget build(BuildContext context) {
    final filteredArticles = selectedCategory == 'Todos' 
        ? mockArticles 
        : mockArticles.where((a) => a.category == selectedCategory).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis Lecturas'),
        centerTitle: true,
      ),
      body: Column(
        children: [
          // FILTROS (CHIPS)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 10),
            child: Row(
              children: categories.map((cat) => Padding(
                padding: const EdgeInsets.only(right: 8.0),
                child: FilterChip(
                  label: Text(cat),
                  selected: selectedCategory == cat,
                  onSelected: (bool selected) {
                    setState(() => selectedCategory = cat);
                  },
                ),
              )).toList(),
            ),
          ),
          
          // GALERÍA DE TARJETAS
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.all(15),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 15,
                mainAxisSpacing: 15,
                childAspectRatio: 0.75,
              ),
              itemCount: filteredArticles.length,
              itemBuilder: (context, index) {
                final article = filteredArticles[index];
                return _buildArticleCard(context, article);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildArticleCard(BuildContext context, ReadingArticle article) {
    IconData categoryIcon = Icons.article;
    if (article.category == 'Ciencia') categoryIcon = Icons.science;
    if (article.category == 'Tecnología') categoryIcon = Icons.biotech;
    if (article.category == 'Deportes') categoryIcon = Icons.sports_soccer;
    if (article.category == 'Historia') categoryIcon = Icons.account_balance;

    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icono y Categoría
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.indigo.withOpacity(0.1),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
              ),
              child: Icon(categoryIcon, size: 50, color: Colors.indigo),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(10.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  article.title, 
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 5),
                Text(article.category, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                const Divider(),
                const Text("Escoge tu nivel:", style: TextStyle(fontSize: 10, color: Colors.grey)),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: ['A2', 'B1', 'B2'].map((lvl) => 
                    InkWell(
                      onTap: () => context.push('/daily-reading', extra: article),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.indigo,
                          borderRadius: BorderRadius.circular(5),
                        ),
                        child: Text(lvl, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                    )
                  ).toList(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// --- PANTALLA DE LECTURA ---
class DailyReadingScreen extends StatelessWidget {
  final ReadingArticle article;
  const DailyReadingScreen({super.key, required this.article});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(article.category)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(article.title, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            Chip(label: Text("Nivel: ${article.level}"), backgroundColor: Colors.amber.shade100),
            const Divider(height: 30),
            Text(article.content, style: const TextStyle(fontSize: 18, height: 1.6)),
          ],
        ),
      ),
    );
  }
}