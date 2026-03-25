import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter/gestures.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../widgets/paragraph_block.dart';
import '../widgets/activity_block.dart';

class ContentBlock {
  final String type;
  final dynamic data;

  ContentBlock({required this.type, required this.data});
}

class ReadingScreen extends StatefulWidget {
  final String articleTitle;
  final String articleId;
  final List<String> paragraphs;
  final Map<int, dynamic> activities; // Map of paragraph index to activity data

  ReadingScreen({
    required this.articleTitle,
    required this.articleId,
    required this.paragraphs,
    required this.activities,
  });

  @override
  _ReadingScreenState createState() => _ReadingScreenState();
}

class _ReadingScreenState extends State<ReadingScreen> {
  late List<ContentBlock> _contentBlocks;
  late ScrollController _scrollController;
  double _progress = 0.0;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController();
    _scrollController.addListener(_updateProgress);
    _buildContentBlocks();
  }

  @override
  void dispose() {
    _scrollController.removeListener(_updateProgress);
    _scrollController.dispose();
    super.dispose();
  }

  void _updateProgress() {
    if (_scrollController.position.maxScrollExtent > 0) {
      setState(() {
        _progress = _scrollController.offset / _scrollController.position.maxScrollExtent;
      });
    }
  }

  void _buildContentBlocks() {
    _contentBlocks = [];
    
    // Interleave paragraphs and activities
    for (int i = 0; i < widget.paragraphs.length; i++) {
      // Add paragraph
      _contentBlocks.add(ContentBlock(
        type: 'paragraph',
        data: widget.paragraphs[i],
      ));
      
      // Add activity if exists for this paragraph
      if (widget.activities.containsKey(i)) {
        _contentBlocks.add(ContentBlock(
          type: 'activity',
          data: widget.activities[i],
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.articleTitle),
      ),
      body: Column(
        children: [
          LinearProgressIndicator(value: _progress),
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              itemCount: _contentBlocks.length,
              itemBuilder: (context, index) {
                final block = _contentBlocks[index];
                
                if (block.type == 'paragraph') {
                  return SelectableText.rich(
                    TextSpan(
                      text: block.data,
                      style: TextStyle(fontSize: 16),
                    ),
                    onSelectionChanged: (selection, cause) {
                      if (selection.isValid && selection.isCollapsed == false) {
                        // Show the selection menu
                        _showSelectionMenu(context, selection);
                      }
                    },
                    contextMenuBuilder: (context, editableTextState) {
                      final selectedText = editableTextState.textEditingValue.text
                          .substring(
                            editableTextState.textEditingValue.selection.start,
                            editableTextState.textEditingValue.selection.end,
                          );
                      
                      // Create a custom context menu
                      return Material(
                        elevation: 4.0,
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: EdgeInsets.symmetric(vertical: 8.0),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              ListTile(
                                title: Text('Translate'),
                                onTap: () {
                                  _translateSelectedText(selectedText, 'es');
                                  editableTextState.hideToolbar();
                                  Navigator.of(context).pop();
                                },
                              ),
                              ListTile(
                                title: Text('Save phrase'),
                                onTap: () {
                                  _saveSelectedPhrase(selectedText);
                                  editableTextState.hideToolbar();
                                  Navigator.of(context).pop();
                                },
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                } else if (block.type == 'activity') {
                  return ActivityBlock(
                    activityData: block.data,
                  );
                }
                
                return SizedBox.shrink(); // Fallback
              },
            ),
          ),
          _buildBottomToolbar(),
        ],
      ),
    );
  }
  
  void _showSelectionMenu(BuildContext context, TextSelection selection) {
    // This method is called when text is selected
    // The actual menu is now handled by the contextMenuBuilder
  }
  
  Future<void> _translateSelectedText(String text, String targetLanguage) async {
    try {
      final response = await http.post(
        Uri.parse('http://localhost:3000/translate-text'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'text': text,
          'target_language': targetLanguage,
        }),
      );
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        
        // Show translation in a modal popup
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: Text('Translation'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Original: $text'),
                SizedBox(height: 8),
                Text('Translated: ${data['translated']}'),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.of(context).pop();
                },
                child: Text('Close'),
              ),
            ],
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to translate text')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }
  
  Future<void> _saveSelectedPhrase(String phrase) async {
    try {
      // Call the save vocabulary endpoint
      final response = await http.post(
        Uri.parse('http://localhost:3000/vocabulary/save'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'word': phrase,
          'definition': 'User saved phrase',
          'example': '',
          'cefr_level': 'B1', // This could be passed as a parameter
        }),
      );
      
      if (response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Phrase saved to vocabulary')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save phrase')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }

  Widget _buildBottomToolbar() {
    return Container(
      padding: EdgeInsets.symmetric(vertical: 8.0, horizontal: 16.0),
      decoration: BoxDecoration(
        color: Theme.of(context).primaryColor.withOpacity(0.1),
        border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          TextButton.icon(
            icon: Icon(Icons.bookmark),
            label: Text('Vocabulary List'),
            onPressed: () {
              // Navigate to vocabulary list
            },
          ),
          TextButton.icon(
            icon: Icon(Icons.arrow_forward),
            label: Text('Next Paragraph'),
            onPressed: () {
              // Scroll to next paragraph
              // This is a simplified implementation
              if (_scrollController.position.pixels < _scrollController.position.maxScrollExtent) {
                _scrollController.animateTo(
                  _scrollController.position.pixels + 300, // Approximate paragraph height
                  duration: Duration(milliseconds: 300),
                  curve: Curves.easeInOut,
                );
              }
            },
          ),
        ],
      ),
    );
  }
}