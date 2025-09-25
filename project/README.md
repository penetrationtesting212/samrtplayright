# Playwright Test Generator API

A production-ready FastAPI application that generates comprehensive test cases from Playwright scripts using advanced AI models.

## 🚀 Features

- **Multi-LLM Support**: Claude 3.5 Sonnet (recommended) and OpenAI models
- **Intelligent Parsing**: Advanced Playwright script analysis and structure extraction
- **Comprehensive Testing**: Functional, security, performance, edge case, and boundary tests
- **Multiple Languages**: Python, JavaScript, TypeScript, and Java output
- **Production Ready**: Docker containerization, health checks, rate limiting, monitoring

## 📋 Requirements

- Python 3.11+
- API keys for at least one LLM provider (Anthropic or OpenAI)
- Docker (optional, for containerized deployment)
- Redis (optional, for production rate limiting)

## 🛠️ Quick Start

### 1. Installation

```bash
# Clone and setup
git clone <repository-url>
cd playwright-test-generator

# Install dependencies
pip install -r requirements.txt

# Copy environment configuration
cp .env.example .env
```

### 2. Configuration

Edit `.env` file with your API keys:

```bash
# Required: At least one LLM API key
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here

# Optional: Additional configuration
DEFAULT_LLM_MODEL=claude-3.5-sonnet
MAX_TOKENS=4000
RATE_LIMIT_PER_MINUTE=60
```

### 3. Development Server

```bash
# Start development server
python scripts/start_dev.py

# Or use uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Production Deployment

```bash
# Using Docker Compose (recommended)
docker-compose up -d

# Or Docker only
docker build -t playwright-test-generator .
docker run -p 8000:8000 --env-file .env playwright-test-generator
```

## 📖 API Documentation

Once running, access the interactive documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🎯 API Endpoints

### Core Endpoints

- `POST /api/v1/generate-tests` - Generate test cases from Playwright scripts
- `POST /api/v1/parse-playwright` - Parse and analyze Playwright scripts
- `GET /api/v1/health` - Health check and system status
- `GET /api/v1/supported-models` - List available LLM models

### Example Usage

```bash
# Generate test cases
curl -X POST "http://localhost:8000/api/v1/generate-tests" \
  -H "Content-Type: application/json" \
  -d '{
    "playwright_script": "test(\"login\", async ({ page }) => { await page.goto(\"https://app.com\"); });",
    "user_prompt_template": "Generate comprehensive test cases...",
    "config": {
      "llm_model": "claude-3.5-sonnet",
      "output_language": "python",
      "test_framework": "pytest",
      "include_security_tests": true
    }
  }'
```

## 🧪 Testing

```bash
# Run all tests
python scripts/run_tests.py

# Run specific test categories
pytest tests/test_api.py -v
pytest tests/ --cov=. --cov-report=html
```

## 🔧 Configuration Options

### LLM Models

- **claude-3.5-sonnet** (recommended) - Best for complex test generation
- **claude-3-haiku** - Fast and efficient for simpler cases
- **gpt-4** - High-quality alternative
- **gpt-3.5-turbo** - Fast and cost-effective

### Output Languages

- **Python** (pytest, unittest)
- **JavaScript** (Jest, Mocha)
- **TypeScript** (Jest)
- **Java** (JUnit)

### Test Types Generated

- **Functional Tests**: Core functionality validation
- **Security Tests**: XSS, SQL injection, authentication bypass
- **Performance Tests**: Response times and load handling
- **Edge Cases**: Boundary conditions and error scenarios
- **Negative Tests**: Invalid input handling

## 🏗️ Architecture

The API follows a clean, modular architecture:

```
├── main.py                 # FastAPI application entry point
├── api/
│   ├── routes/            # API route definitions
│   └── dependencies.py    # Dependency injection
├── services/
│   ├── llm_service.py     # LLM integration
│   ├── playwright_parser.py # Script parsing
│   ├── prompt_builder.py  # Prompt construction
│   └── test_generator.py  # Main orchestration
├── models/
│   ├── requests.py        # Request models
│   └── responses.py       # Response models
├── config/
│   └── settings.py        # Configuration management
└── utils/
    ├── logging_config.py  # Logging setup
    └── validation.py      # Input validation
```

## 🔒 Security

- Input validation and sanitization
- Rate limiting per client IP
- Optional API key authentication
- Security test generation capabilities
- No sensitive data logging

## 📊 Monitoring

- Structured logging with correlation IDs
- Health check endpoints
- Performance metrics
- Error tracking and alerting
- LLM service monitoring

## 🚀 Production Deployment

### Environment Variables

Set these in production:

```bash
DEBUG=false
LOG_LEVEL=INFO
RATE_LIMIT_PER_MINUTE=100
REDIS_URL=redis://your-redis-instance
ALLOWED_API_KEYS=["prod-key-1","prod-key-2"]
```

### Scaling

- Use multiple workers: `--workers 4`
- Deploy behind load balancer
- Use Redis for distributed rate limiting
- Monitor memory usage for large scripts

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the API documentation at `/docs`
2. Review the health check endpoint at `/health`
3. Check logs for detailed error information
4. Ensure proper API key configuration