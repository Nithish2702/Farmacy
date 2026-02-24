"""fix nullable fields

Revision ID: fix_nullable_fields
Revises: merge_heads
Create Date: 2024-03-19 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'fix_nullable_fields'
down_revision = 'merge_heads'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Use ALTER COLUMN to make fields nullable
    op.alter_column('disease_prediction_history', 'crop_name',
                    existing_type=sa.String(length=100),
                    nullable=True)
    op.alter_column('disease_prediction_history', 'query',
                    existing_type=sa.String(length=500),
                    nullable=True)

def downgrade() -> None:
    # Revert changes - make fields non-nullable again
    op.alter_column('disease_prediction_history', 'crop_name',
                    existing_type=sa.String(length=100),
                    nullable=False)
    op.alter_column('disease_prediction_history', 'query',
                    existing_type=sa.String(length=500),
                    nullable=False) 