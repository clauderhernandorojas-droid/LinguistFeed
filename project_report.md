# PROJECT PURPOSE
The project, named LinguistFeed, is designed to facilitate language learning through reading articles. It provides a platform for students to access various articles categorized by topics and levels, enhancing their vocabulary and comprehension skills.

# FOLDER STRUCTURE
- **lib/**: Contains the main application code.
  - **main.dart**: The entry point of the application, setting up the app structure and navigation.
  
- **backend/**: Contains server-side code and services for handling data and business logic.

# MAIN SCREENS
1. **LoginScreen**: The initial screen where users can log in as students.
2. **StudentFeedScreen**: Displays a list of articles available for students, with filtering options.
3. **DailyReadingScreen**: Shows the content of a selected article, including its title, category, and level.

# STUDENT INTERFACE
The student interface allows users to:
- Log in to the application.
- View a feed of articles categorized by topics (e.g., Science, Technology).
- Filter articles based on selected categories.
- Select articles to read, with options to choose reading levels (A2, B1, B2).

# TEACHER INTERFACE
Currently, there is no specific teacher interface implemented in the provided code.

# IMPLEMENTED FEATURES
- User login functionality.
- Article listing with filtering options.
- Article reading with detailed content display.

# PARTIALLY IMPLEMENTED FEATURES
- None identified in the provided code.

# INACTIVE / PREPARED FEATURES
- The teacher interface is not implemented but may be planned for future development.

# DATA MODELS
- **VocabularyItem**: Represents a vocabulary word with its definition and example.
- **ReadingArticle**: Represents an article with a title, category, level, content, and associated vocabulary items.

# NAVIGATION FLOW
- The app starts at the **LoginScreen**.
- After logging in, users are directed to the **StudentFeedScreen**.
- From the feed, users can select an article to navigate to the **DailyReadingScreen**.

# IMPORTANT NOTES FOR FUTURE DEVELOPERS
- Ensure to implement the teacher interface to provide additional functionalities for educators.
- Consider adding more features for tracking student progress and gamification elements to enhance user engagement.