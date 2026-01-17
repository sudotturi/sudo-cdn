# Contributing to Raspberry Pi CDN

First off, thank you for considering contributing to Raspberry Pi CDN! It's people like you that make this project better.

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful and considerate in all interactions.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title** for the issue
- **Describe the exact steps** to reproduce the problem
- **Provide specific examples** to demonstrate the steps
- **Describe the behavior** you observed after following the steps
- **Explain which behavior** you expected to see instead and why
- **Include screenshots** if applicable

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description** of the suggested enhancement
- **Provide specific examples** to demonstrate the steps
- **Describe the current behavior** and explain which behavior you expected to see instead
- **Explain why this enhancement** would be useful

### Pull Requests

- Fill in the required template
- Do not include issue numbers in the PR title
- Include screenshots and animated GIFs in your pull request whenever possible
- Follow the JavaScript style guide (see below)
- Include thoughtfully-worded, well-structured tests
- Document new code based on the Documentation Styleguide
- End all files with a newline

## Development Process

1. Fork the repository
2. Clone your fork (`git clone https://github.com/yourusername/raspberry-pi-cdn.git`)
3. Create a branch for your changes (`git checkout -b feature/my-amazing-feature`)
4. Make your changes
5. Test your changes thoroughly
6. Commit your changes (`git commit -m 'Add some amazing feature'`)
7. Push to the branch (`git push origin feature/my-amazing-feature`)
8. Open a Pull Request

## Code Style

### JavaScript

- Use ES6+ features where appropriate
- Use `const` and `let` instead of `var`
- Use arrow functions where appropriate
- Follow existing code style and conventions
- Add comments for complex logic

### File Structure

```
raspberry-pi-cdn/
├── server.js          # Main server file
├── config.js          # Configuration
├── auth.js            # Authentication logic
├── utils.js           # Helper functions
├── storage.js         # Storage operations
├── public/            # Frontend files
│   ├── index.html
│   ├── style.css
│   └── app.js
└── storage/           # Auto-created storage
```

### Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### Testing

- Test your changes on a Raspberry Pi if possible
- Test with different image formats and sizes
- Test authentication flows
- Test error handling

## Questions?

If you have any questions, please open an issue with the `question` label.

Thank you for contributing! 🎉

