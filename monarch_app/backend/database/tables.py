from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from sqlalchemy.sql import func

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    
    # Relationship to files
    files = relationship("File", back_populates="owner")

class File(Base):
    __tablename__ = 'files'

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_path = Column(String)
    file_type = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Foreign key to link file to user
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Relationship to user
    owner = relationship("User", back_populates="files")

class TableVersion(Base):
    __tablename__ = "table_versions"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"))
    table_name = Column(String)
    version = Column(Integer)  # Incremental version number
    is_current = Column(Boolean, default=True)  # Whether this is the current version
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(String)  # Description of what changed in this version