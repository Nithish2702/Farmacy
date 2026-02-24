"""make nullable fields

Revision ID: make_nullable_fields
Revises: 1453de644f3f
Create Date: 2024-03-19 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'make_nullable_fields'
down_revision = '1453de644f3f'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Create a new table with the desired schema
    op.create_table(
        'disease_prediction_history_new',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('prediction_id', sa.String(length=100), nullable=False),
        sa.Column('crop_name', sa.String(length=100), nullable=True),  # Made nullable
        sa.Column('query', sa.String(length=500), nullable=True),  # Made nullable
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('prediction_result', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Copy data from old table to new table
    op.execute(
        """
        INSERT INTO disease_prediction_history_new 
        SELECT id, user_id, prediction_id, crop_name, query, image_url, prediction_result, created_at 
        FROM disease_prediction_history;
        """
    )

    # Drop old table
    op.drop_table('disease_prediction_history')

    # Rename new table to original name
    op.rename_table('disease_prediction_history_new', 'disease_prediction_history')

    # Recreate indexes
    op.create_index(
        'ix_disease_prediction_history_id',
        'disease_prediction_history',
        ['id'],
        unique=False
    )
    op.create_index(
        'ix_disease_prediction_history_prediction_id',
        'disease_prediction_history',
        ['prediction_id'],
        unique=True
    )
    op.create_index(
        'ix_disease_prediction_history_user_id',
        'disease_prediction_history',
        ['user_id'],
        unique=False
    )

def downgrade() -> None:
    # Create a new table with the original schema
    op.create_table(
        'disease_prediction_history_old',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('prediction_id', sa.String(length=100), nullable=False),
        sa.Column('crop_name', sa.String(length=100), nullable=False),  # Not nullable
        sa.Column('query', sa.String(length=500), nullable=True),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('prediction_result', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Copy data from current table to old schema table
    op.execute(
        """
        INSERT INTO disease_prediction_history_old 
        SELECT id, user_id, prediction_id, crop_name, query, image_url, prediction_result, created_at 
        FROM disease_prediction_history;
        """
    )

    # Drop current table
    op.drop_table('disease_prediction_history')

    # Rename old schema table to original name
    op.rename_table('disease_prediction_history_old', 'disease_prediction_history')

    # Recreate indexes
    op.create_index(
        'ix_disease_prediction_history_id',
        'disease_prediction_history',
        ['id'],
        unique=False
    )
    op.create_index(
        'ix_disease_prediction_history_prediction_id',
        'disease_prediction_history',
        ['prediction_id'],
        unique=True
    )
    op.create_index(
        'ix_disease_prediction_history_user_id',
        'disease_prediction_history',
        ['user_id'],
        unique=False
    ) 