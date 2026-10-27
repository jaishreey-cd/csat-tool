"""create_phase2_surveys_and_questions

Revision ID: 3fa821834a9e
Revises: 93ce04dfd98e
Create Date: 2026-10-26 16:23:26.024610

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3fa821834a9e'
down_revision: Union[str, Sequence[str], None] = '93ce04dfd98e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('question_templates',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('section_number', sa.Integer(), nullable=False),
    sa.Column('section_title', sa.String(length=150), nullable=False),
    sa.Column('question_text', sa.Text(), nullable=False),
    sa.Column('response_type', sa.String(length=30), nullable=False),
    sa.Column('applicable_phases', sa.String(length=255), nullable=False),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_question_templates_id'), 'question_templates', ['id'], unique=False)
    op.create_index(op.f('ix_question_templates_section_number'), 'question_templates', ['section_number'], unique=False)
    op.create_table('surveys',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('survey_code', sa.String(length=50), nullable=False),
    sa.Column('client_id', sa.Integer(), nullable=False),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('phase', sa.String(length=50), nullable=False),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('creator_id', sa.Integer(), nullable=False),
    sa.Column('reviewer_id', sa.Integer(), nullable=True),
    sa.Column('rejection_comment', sa.Text(), nullable=True),
    sa.Column('unique_token', sa.String(length=100), nullable=True),
    sa.Column('client_contact_name', sa.String(length=100), nullable=True),
    sa.Column('client_contact_email', sa.String(length=255), nullable=True),
    sa.Column('sent_at', sa.DateTime(), nullable=True),
    sa.Column('followup_sent_at', sa.DateTime(), nullable=True),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.Column('average_score', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_surveys_id'), 'surveys', ['id'], unique=False)
    op.create_index(op.f('ix_surveys_status'), 'surveys', ['status'], unique=False)
    op.create_index(op.f('ix_surveys_survey_code'), 'surveys', ['survey_code'], unique=True)
    op.create_index(op.f('ix_surveys_unique_token'), 'surveys', ['unique_token'], unique=True)
    op.create_table('survey_questions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('survey_id', sa.Integer(), nullable=False),
    sa.Column('section_number', sa.Integer(), nullable=False),
    sa.Column('section_title', sa.String(length=150), nullable=False),
    sa.Column('question_text', sa.Text(), nullable=False),
    sa.Column('response_type', sa.String(length=30), nullable=False),
    sa.Column('is_custom', sa.Boolean(), nullable=False),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['survey_id'], ['surveys.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_survey_questions_id'), 'survey_questions', ['id'], unique=False)
    op.create_table('survey_answers',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('survey_id', sa.Integer(), nullable=False),
    sa.Column('question_id', sa.Integer(), nullable=False),
    sa.Column('rating_score', sa.Integer(), nullable=True),
    sa.Column('text_answer', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['question_id'], ['survey_questions.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['survey_id'], ['surveys.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_survey_answers_id'), 'survey_answers', ['id'], unique=False)
    op.add_column('projects', sa.Column('status', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('role', sa.String(length=50), nullable=False, server_default='PMO'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'role')
    op.drop_column('projects', 'status')
    op.drop_index(op.f('ix_survey_answers_id'), table_name='survey_answers')
    op.drop_table('survey_answers')
    op.drop_index(op.f('ix_survey_questions_id'), table_name='survey_questions')
    op.drop_table('survey_questions')
    op.drop_index(op.f('ix_surveys_unique_token'), table_name='surveys')
    op.drop_index(op.f('ix_surveys_survey_code'), table_name='surveys')
    op.drop_index(op.f('ix_surveys_status'), table_name='surveys')
    op.drop_index(op.f('ix_surveys_id'), table_name='surveys')
    op.drop_table('surveys')
    op.drop_index(op.f('ix_question_templates_section_number'), table_name='question_templates')
    op.drop_index(op.f('ix_question_templates_id'), table_name='question_templates')
    op.drop_table('question_templates')
