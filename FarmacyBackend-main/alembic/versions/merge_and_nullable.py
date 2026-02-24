"""merge heads and make fields nullable

Revision ID: merge_and_nullable
Revises: cc654d3c442e, 53337ddd9bf0, 8053070e28d3, 84d9f9ee91bd
Create Date: 2024-03-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'merge_and_nullable'
down_revision = ('cc654d3c442e', '53337ddd9bf0', '8053070e28d3', '84d9f9ee91bd')
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Make crop_name and query nullable
    with op.batch_alter_table('disease_prediction_history') as batch_op:
        batch_op.alter_column('crop_name',
                    existing_type=sa.String(length=100),
                    nullable=True)
        batch_op.alter_column('query',
                    existing_type=sa.String(length=500),
                    nullable=True)

def downgrade() -> None:
    # Make crop_name non-nullable again
    with op.batch_alter_table('disease_prediction_history') as batch_op:
        batch_op.alter_column('crop_name',
                    existing_type=sa.String(length=100),
                    nullable=False)
        # Leave query as nullable as it was originally nullable 