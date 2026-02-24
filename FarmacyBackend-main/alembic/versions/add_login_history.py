"""Add login history table

Revision ID: 4453de644f3f
Revises: 3453de644f3f
Create Date: 2024-03-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4453de644f3f'
down_revision: str = '3453de644f3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create user_login_history table."""
    op.create_table(
        'user_login_history',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('login_time', sa.DateTime(), nullable=False),
        sa.Column('logout_time', sa.DateTime(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('device_type', sa.String(20), nullable=True),
        sa.Column('login_status', sa.Boolean(), default=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_user_login_history_user_id', 'user_login_history', ['user_id'])
    op.create_index('ix_user_login_history_login_time', 'user_login_history', ['login_time'])


def downgrade() -> None:
    """Remove user_login_history table."""
    op.drop_index('ix_user_login_history_login_time')
    op.drop_index('ix_user_login_history_user_id')
    op.drop_table('user_login_history') 