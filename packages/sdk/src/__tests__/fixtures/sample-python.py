"""
Sample Python file with various import patterns for testing
"""

# Standard library imports
import os
import sys
from pathlib import Path

# Third-party imports
import requests
from flask import Flask, jsonify
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker

# Relative imports
from . import utils
from .config import Config
from ..models import User, Post

# Aliased imports
import numpy as np
import pandas as pd
from typing import Optional, List as ListType

# Multi-line import
from mymodule import (
    ClassA,
    ClassB,
    function_a,
    function_b,
)

# Conditional import (still detected as import)
try:
    import ujson as json
except ImportError:
    import json

# Sample class using imports
class DataProcessor:
    def __init__(self, config: Config):
        self.config = config
        self.engine = create_engine(config.database_url)
        self.Session = sessionmaker(bind=self.engine)

    def fetch_data(self, url: str) -> Optional[dict]:
        response = requests.get(url)
        if response.ok:
            return response.json()
        return None

    def process(self, data: ListType[dict]) -> pd.DataFrame:
        return pd.DataFrame(data)


def main():
    app = Flask(__name__)
    processor = DataProcessor(Config())

    @app.route("/health")
    def health():
        return jsonify({"status": "ok"})

    app.run()


if __name__ == "__main__":
    main()
