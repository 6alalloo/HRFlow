import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================
  // 1. ROLES (Upsert - idempotent)
  // ============================================
  console.log('Creating roles...');

  const adminRole = await prisma.roles.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin' }
  });

  const operatorRole = await prisma.roles.upsert({
    where: { name: 'Operator' },
    update: {},
    create: { name: 'Operator' }
  });

  console.log(`✅ Roles created: Admin (${adminRole.id}), Operator (${operatorRole.id})`);

  // ============================================
  // 2. USERS (Upsert - idempotent with hashed passwords)
  // ============================================
  console.log('Creating users...');

  const adminPasswordHash = await hashPassword('admin123');
  const operatorPasswordHash = await hashPassword('operator123');

  const adminUser = await prisma.users.upsert({
    where: { email: 'admin@hrflow.local' },
    update: {
      password_hash: adminPasswordHash // Update password hash if user exists
    },
    create: {
      email: 'admin@hrflow.local',
      password_hash: adminPasswordHash,
      full_name: 'System Administrator',
      is_active: true,
      role_id: adminRole.id
    }
  });

  const operatorUser = await prisma.users.upsert({
    where: { email: 'operator@hrflow.local' },
    update: {
      password_hash: operatorPasswordHash // Update password hash if user exists
    },
    create: {
      email: 'operator@hrflow.local',
      password_hash: operatorPasswordHash,
      full_name: 'HR Operator',
      is_active: true,
      role_id: operatorRole.id
    }
  });

  console.log(`✅ Users created: admin@hrflow.local (${adminUser.id}), operator@hrflow.local (${operatorUser.id})`);

  // ============================================
  // 3. MIGRATE EXISTING WORKFLOWS TO ADMIN USER
  // ============================================
  console.log('Migrating orphan workflows to admin user...');

  const migrated = await prisma.workflows.updateMany({
    where: { owner_user_id: null },
    data: { owner_user_id: adminUser.id }
  });

  console.log(`✅ Migrated ${migrated.count} workflows to admin user`);

  // ============================================
  // 4. TEMPLATE WORKFLOW 1: Employee Onboarding
  // ============================================
  console.log('Creating template workflow: Employee Onboarding...');

  const existingOnboarding = await prisma.workflows.findFirst({
    where: { name: '[Template] Employee Onboarding' }
  });

  if (!existingOnboarding) {
    const onboardingWorkflow = await prisma.workflows.create({
      data: {
        name: '[Template] Employee Onboarding',
        description: 'Template workflow for new employee onboarding process. Sends welcome email, creates database record, and logs the action.',
        is_active: true,
        owner_user_id: adminUser.id,
        n8n_webhook_path: '/webhook/hrflow/template-onboarding/execute'
      }
    });

    // Create nodes for onboarding workflow
    const triggerNode = await prisma.workflow_nodes.create({
      data: {
        workflow_id: onboardingWorkflow.id,
        kind: 'trigger',
        name: 'Start Onboarding',
        config_json: JSON.stringify({ triggerType: 'manual' }),
        pos_x: 100,
        pos_y: 200
      }
    });

    const emailNode = await prisma.workflow_nodes.create({
      data: {
        workflow_id: onboardingWorkflow.id,
        kind: 'email',
        name: 'Send Welcome Email',
        config_json: JSON.stringify({
          to: '{{$json.employee_email}}',
          subject: 'Welcome to the Team!',
          body: 'Dear {{$json.employee_name}},\n\nWelcome to our organization! We are excited to have you on board.\n\nBest regards,\nHR Team'
        }),
        pos_x: 350,
        pos_y: 200
      }
    });

    const dbNode = await prisma.workflow_nodes.create({
      data: {
        workflow_id: onboardingWorkflow.id,
        kind: 'database',
        name: 'Create Employee Record',
        config_json: JSON.stringify({
          operation: 'insert',
          table: 'employees',
          columns: 'user_id, hire_date, is_active',
          values: '{{$json.user_id}}, NOW(), true'
        }),
        pos_x: 600,
        pos_y: 200
      }
    });

    const loggerNode = await prisma.workflow_nodes.create({
      data: {
        workflow_id: onboardingWorkflow.id,
        kind: 'logger',
        name: 'Log Onboarding',
        config_json: JSON.stringify({
          message: 'Employee onboarding completed for: {{$json.employee_name}}',
          level: 'info',
          includeInput: true
        }),
        pos_x: 850,
        pos_y: 200
      }
    });

    // Create edges (trigger -> email -> db -> logger)
    await prisma.workflow_edges.create({
      data: {
        workflow_id: onboardingWorkflow.id,
        from_node_id: triggerNode.id,
        to_node_id: emailNode.id,
        condition_json: '{}'
      }
    });

    await prisma.workflow_edges.create({
      data: {
        workflow_id: onboardingWorkflow.id,
        from_node_id: emailNode.id,
        to_node_id: dbNode.id,
        condition_json: '{}'
      }
    });

    await prisma.workflow_edges.create({
      data: {
        workflow_id: onboardingWorkflow.id,
        from_node_id: dbNode.id,
        to_node_id: loggerNode.id,
        condition_json: '{}'
      }
    });

    console.log(`✅ Created template workflow: Employee Onboarding (${onboardingWorkflow.id})`);
  } else {
    console.log('⏭️  Template workflow "Employee Onboarding" already exists, skipping...');
  }

  // ============================================
  // 5. TEMPLATE WORKFLOW 2: Interview Scheduling
  // ============================================
  console.log('Creating template workflow: Interview Scheduling...');

  const existingInterview = await prisma.workflows.findFirst({
    where: { name: '[Template] Interview Scheduling' }
  });

  if (!existingInterview) {
    const interviewWorkflow = await prisma.workflows.create({
      data: {
        name: '[Template] Interview Scheduling',
        description: 'Template workflow for scheduling candidate interviews. Parses CV, checks availability, and sends interview invitation.',
        is_active: true,
        owner_user_id: adminUser.id,
        n8n_webhook_path: '/webhook/hrflow/template-interview/execute'
      }
    });

    // Create nodes for interview workflow
    const triggerNode2 = await prisma.workflow_nodes.create({
      data: {
        workflow_id: interviewWorkflow.id,
        kind: 'trigger',
        name: 'Receive Application',
        config_json: JSON.stringify({ triggerType: 'manual' }),
        pos_x: 100,
        pos_y: 200
      }
    });

    const cvParseNode = await prisma.workflow_nodes.create({
      data: {
        workflow_id: interviewWorkflow.id,
        kind: 'cv_parse',
        name: 'Parse CV',
        config_json: JSON.stringify({
          inputType: 'url',
          cvUrl: '{{$json.cv_url}}'
        }),
        pos_x: 350,
        pos_y: 200
      }
    });

    const conditionNode = await prisma.workflow_nodes.create({
      data: {
        workflow_id: interviewWorkflow.id,
        kind: 'condition',
        name: 'Check Experience',
        config_json: JSON.stringify({
          field: 'experience_years',
          operator: '>=',
          value: '3'
        }),
        pos_x: 600,
        pos_y: 200
      }
    });

    const datetimeNode = await prisma.workflow_nodes.create({
      data: {
        workflow_id: interviewWorkflow.id,
        kind: 'datetime',
        name: 'Schedule Interview',
        config_json: JSON.stringify({
          operation: 'add',
          inputDate: '{{$now}}',
          amount: '3',
          unit: 'days',
          outputFormat: 'YYYY-MM-DD HH:mm'
        }),
        pos_x: 850,
        pos_y: 100
      }
    });

    const emailNode2 = await prisma.workflow_nodes.create({
      data: {
        workflow_id: interviewWorkflow.id,
        kind: 'email',
        name: 'Send Interview Invite',
        config_json: JSON.stringify({
          to: '{{$json.candidate_email}}',
          subject: 'Interview Invitation - {{$json.position}}',
          body: 'Dear {{$json.candidate_name}},\n\nWe are pleased to invite you for an interview scheduled on {{$json.interview_date}}.\n\nBest regards,\nHR Team'
        }),
        pos_x: 1100,
        pos_y: 100
      }
    });

    const rejectEmailNode = await prisma.workflow_nodes.create({
      data: {
        workflow_id: interviewWorkflow.id,
        kind: 'email',
        name: 'Send Rejection',
        config_json: JSON.stringify({
          to: '{{$json.candidate_email}}',
          subject: 'Application Update - {{$json.position}}',
          body: 'Dear {{$json.candidate_name}},\n\nThank you for your interest. Unfortunately, we are looking for candidates with more experience at this time.\n\nBest regards,\nHR Team'
        }),
        pos_x: 850,
        pos_y: 350
      }
    });

    const loggerNode2 = await prisma.workflow_nodes.create({
      data: {
        workflow_id: interviewWorkflow.id,
        kind: 'logger',
        name: 'Log Result',
        config_json: JSON.stringify({
          message: 'Interview scheduling completed for: {{$json.candidate_name}}',
          level: 'info',
          includeInput: true
        }),
        pos_x: 1350,
        pos_y: 200
      }
    });

    // Create edges for interview workflow
    // trigger -> cv_parse
    await prisma.workflow_edges.create({
      data: {
        workflow_id: interviewWorkflow.id,
        from_node_id: triggerNode2.id,
        to_node_id: cvParseNode.id,
        condition_json: '{}'
      }
    });

    // cv_parse -> condition
    await prisma.workflow_edges.create({
      data: {
        workflow_id: interviewWorkflow.id,
        from_node_id: cvParseNode.id,
        to_node_id: conditionNode.id,
        condition_json: '{}'
      }
    });

    // condition -> datetime (true branch - experienced)
    await prisma.workflow_edges.create({
      data: {
        workflow_id: interviewWorkflow.id,
        from_node_id: conditionNode.id,
        to_node_id: datetimeNode.id,
        condition_json: JSON.stringify({ branch: 'true' }),
        label: 'Experienced'
      }
    });

    // condition -> reject email (false branch - not enough experience)
    await prisma.workflow_edges.create({
      data: {
        workflow_id: interviewWorkflow.id,
        from_node_id: conditionNode.id,
        to_node_id: rejectEmailNode.id,
        condition_json: JSON.stringify({ branch: 'false' }),
        label: 'Not Qualified'
      }
    });

    // datetime -> interview email
    await prisma.workflow_edges.create({
      data: {
        workflow_id: interviewWorkflow.id,
        from_node_id: datetimeNode.id,
        to_node_id: emailNode2.id,
        condition_json: '{}'
      }
    });

    // interview email -> logger
    await prisma.workflow_edges.create({
      data: {
        workflow_id: interviewWorkflow.id,
        from_node_id: emailNode2.id,
        to_node_id: loggerNode2.id,
        condition_json: '{}'
      }
    });

    // reject email -> logger
    await prisma.workflow_edges.create({
      data: {
        workflow_id: interviewWorkflow.id,
        from_node_id: rejectEmailNode.id,
        to_node_id: loggerNode2.id,
        condition_json: '{}'
      }
    });

    console.log(`✅ Created template workflow: Interview Scheduling (${interviewWorkflow.id})`);
  } else {
    console.log('⏭️  Template workflow "Interview Scheduling" already exists, skipping...');
  }

  console.log('');
  console.log('🎉 Database seed completed successfully!');
  console.log('');
  console.log('Default credentials:');
  console.log('  Admin:    admin@hrflow.local / admin123');
  console.log('  Operator: operator@hrflow.local / operator123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
