"""
Script to run comprehensive tests for the API.
"""

import subprocess
import sys
import os

def run_tests():
    """Run all tests with coverage reporting."""
    
    # Set environment variables for testing
    os.environ.setdefault("DEBUG", "true")
    os.environ.setdefault("LOG_LEVEL", "DEBUG")
    
    try:
        # Run pytest with coverage
        cmd = [
            "python", "-m", "pytest",
            "tests/",
            "--cov=.",
            "--cov-report=html",
            "--cov-report=term-missing",
            "--verbose",
            "-x"  # Stop on first failure
        ]
        
        print("Running test suite...")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        
        if result.returncode == 0:
            print("\n✅ All tests passed!")
            print("📊 Coverage report generated in htmlcov/")
        else:
            print(f"\n❌ Tests failed with return code {result.returncode}")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Error running tests: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_tests()