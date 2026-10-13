"""Run the local image-search API with ``python -m image_search``."""

import uvicorn


if __name__ == "__main__":
    uvicorn.run("image_search.app:app", host="127.0.0.1", port=8000, reload=True)
