"""merge heads

Revision ID: merge_heads
Revises: make_nullable_fields, merge_and_nullable
Create Date: 2024-03-19 13:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'merge_heads'
down_revision = ('make_nullable_fields', 'merge_and_nullable')
branch_labels = None
depends_on = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass 