import 'package:flutter/material.dart';

class WordPopup extends StatelessWidget {
  final String word;
  final String definition;
  final String example;

  WordPopup({required this.word, required this.definition, required this.example});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(word),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Definition: $definition'),
          SizedBox(height: 8),
          Text('Example: $example'),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () {
            // Logic to save the word
            // Call the save vocabulary endpoint
          },
          child: Text('Save word'),
        ),
        TextButton(
          onPressed: () {
            Navigator.of(context).pop();
          },
          child: Text('Close'),
        ),
      ],
    );
  }
}