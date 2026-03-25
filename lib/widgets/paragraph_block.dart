import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import './word_popup.dart';

class ParagraphBlock extends StatelessWidget {
  final String paragraphText;
  final String articleId;
  final String cefrLevel;

  ParagraphBlock({required this.paragraphText, required this.articleId, required this.cefrLevel});

  @override
  Widget build(BuildContext context) {
    // Split paragraph text into words
    List<String> words = paragraphText.split(' ');

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: RichText(
        text: TextSpan(
          style: TextStyle(fontSize: 16, color: Colors.black),
          children: _buildWordSpans(context, words),
        ),
      ),
    );
  }

  List<InlineSpan> _buildWordSpans(BuildContext context, List<String> words) {
    List<InlineSpan> spans = [];

    for (int i = 0; i < words.length; i++) {
      String word = words[i];
      
      // Clean the word from punctuation for tapping, but keep original for display
      String cleanWord = word.replaceAll(RegExp(r'[^\w\s]'), '').toLowerCase();
      
      // Find the sentence containing this word (for context)
      String sentence = _findSentenceForWord(paragraphText, word);
      
      spans.add(
        TextSpan(
          text: word + (i < words.length - 1 ? ' ' : ''),
          style: TextStyle(
            color: Colors.black,
            decoration: TextDecoration.none,
          ),
          recognizer: TapGestureRecognizer()
            ..onTap = () {
              if (cleanWord.isNotEmpty) {
                _handleWordTap(context, cleanWord, sentence);
              }
            },
        ),
      );
    }

    return spans;
  }

  String _findSentenceForWord(String text, String word) {
    // Simple sentence extraction - can be improved
    final sentences = text.split(RegExp(r'(?<=[.!?])\s+'));
    for (var sentence in sentences) {
      if (sentence.contains(word)) {
        return sentence;
      }
    }
    return text; // Fallback to the whole paragraph
  }

  Future<void> _handleWordTap(BuildContext context, String word, String sentence) async {
    try {
      // Call the backend API to get the definition
      final response = await http.post(
        Uri.parse('http://localhost:3000/define-word'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'word': word,
          'sentence': sentence,
          'cefr_level': cefrLevel,
        }),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        
        // Show the word popup
        showDialog(
          context: context,
          builder: (context) => WordPopup(
            word: data['word'],
            definition: data['definition'],
            example: data['example'],
          ),
        );
      } else {
        // Handle error
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to get definition')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }
}
