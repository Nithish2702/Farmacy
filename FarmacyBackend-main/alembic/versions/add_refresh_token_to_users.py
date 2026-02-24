"""Add refresh token to users table

Revision ID: 3453de644f3f
Revises: 1453de644f3f
Create Date: 2024-03-19 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3453de644f3f'
down_revision: str = '1453de644f3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add refresh token fields to users table and clean up old table."""
    # First drop the existing refresh_tokens table if it exists
    op.execute('DROP TABLE IF EXISTS refresh_tokens CASCADE')
    
    # Add refresh token fields to users table
    op.add_column('users', sa.Column('refresh_token', sa.String(500), nullable=True, unique=True))
    op.add_column('users', sa.Column('refresh_token_expires_at', sa.DateTime(), nullable=True))
    op.create_index('ix_users_refresh_token', 'users', ['refresh_token'], unique=True)


def downgrade() -> None:
    """Remove refresh token fields from users table."""
    op.drop_index('ix_users_refresh_token')
    op.drop_column('users', 'refresh_token_expires_at')
    op.drop_column('users', 'refresh_token') 