import os
import pkgutil
import importlib
from app.database import Base

# Import all modules in this directory except __init__.py
package_name = "app.models"
package_path = os.path.dirname(__file__)

for _, module_name, _ in pkgutil.iter_modules([package_path]):
    if module_name != "__init__":
        importlib.import_module(f"{package_name}.{module_name}")

# Dynamically expose all model classes that SQLAlchemy knows about
__all__ = []
for mapper in Base.registry.mappers:
    cls = mapper.class_
    globals()[cls.__name__] = cls
    __all__.append(cls.__name__)

if __name__ == "__main__":
    print(package_name)
    print(__all__)