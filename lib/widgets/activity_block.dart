import 'package:flutter/material.dart';

class ActivityBlock extends StatefulWidget {
  final dynamic activityData; // Adjust type based on your activity structure

  ActivityBlock({required this.activityData});

  @override
  _ActivityBlockState createState() => _ActivityBlockState();
}

class _ActivityBlockState extends State<ActivityBlock> {
  // For multiple choice
  int? _selectedOptionIndex;
  
  // For fill in the blank
  final TextEditingController _textController = TextEditingController();
  bool _isCorrect = false;
  bool _hasSubmitted = false;

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    switch (widget.activityData['type']) {
      case 'multiple_choice':
        return _buildMultipleChoiceActivity();
      case 'fill_in_the_blank':
        return _buildFillInTheBlankActivity();
      default:
        return Container(
          padding: EdgeInsets.all(16),
          child: Text('Unsupported activity type: ${widget.activityData['type']}'),
        );
    }
  }

  Widget _buildMultipleChoiceActivity() {
    return Card(
      margin: EdgeInsets.all(16),
      elevation: 2,
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.activityData['question'],
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),
            ...List.generate(widget.activityData['data']['options'].length, (index) {
              final isSelected = _selectedOptionIndex == index;
              final isCorrect = widget.activityData['data']['correct_index'] == index;
              
              // Determine the color based on selection and correctness
              Color? tileColor;
              if (_hasSubmitted) {
                if (isCorrect) {
                  tileColor = Colors.green.withOpacity(0.2);
                } else if (isSelected && !isCorrect) {
                  tileColor = Colors.red.withOpacity(0.2);
                }
              } else if (isSelected) {
                tileColor = Colors.blue.withOpacity(0.1);
              }
              
              return ListTile(
                title: Text(widget.activityData['data']['options'][index]),
                tileColor: tileColor,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(
                    color: isSelected ? Colors.blue : Colors.transparent,
                    width: 2,
                  ),
                ),
                onTap: _hasSubmitted ? null : () {
                  setState(() {
                    _selectedOptionIndex = index;
                  });
                },
              );
            }),
            SizedBox(height: 16),
            if (!_hasSubmitted)
              ElevatedButton(
                onPressed: _selectedOptionIndex != null ? _checkMultipleChoiceAnswer : null,
                child: Text('Submit'),
              ),
            if (_hasSubmitted)
              Text(
                _isCorrect ? 'Correct!' : 'Incorrect. Try again!',
                style: TextStyle(
                  color: _isCorrect ? Colors.green : Colors.red,
                  fontWeight: FontWeight.bold,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildFillInTheBlankActivity() {
    return Card(
      margin: EdgeInsets.all(16),
      elevation: 2,
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.activityData['question'],
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),
            TextField(
              controller: _textController,
              decoration: InputDecoration(
                hintText: 'Your answer here',
                border: OutlineInputBorder(),
                filled: true,
                fillColor: _hasSubmitted
                    ? (_isCorrect ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1))
                    : null,
              ),
              enabled: !_hasSubmitted,
            ),
            SizedBox(height: 16),
            if (!_hasSubmitted)
              ElevatedButton(
                onPressed: _textController.text.isNotEmpty ? _checkFillInTheBlankAnswer : null,
                child: Text('Submit'),
              ),
            if (_hasSubmitted)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _isCorrect ? 'Correct!' : 'Incorrect. Try again!',
                    style: TextStyle(
                      color: _isCorrect ? Colors.green : Colors.red,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (!_isCorrect)
                    Text(
                      'Correct answer: ${widget.activityData['data']['answer']}',
                      style: TextStyle(fontStyle: FontStyle.italic),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  void _checkMultipleChoiceAnswer() {
    if (_selectedOptionIndex != null) {
      setState(() {
        _hasSubmitted = true;
        _isCorrect = _selectedOptionIndex == widget.activityData['data']['correct_index'];
      });
    }
  }

  void _checkFillInTheBlankAnswer() {
    final userAnswer = _textController.text.trim().toLowerCase();
    final correctAnswer = widget.activityData['data']['answer'].toLowerCase();
    
    setState(() {
      _hasSubmitted = true;
      _isCorrect = userAnswer == correctAnswer;
    });
  }
}
