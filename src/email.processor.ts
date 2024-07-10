import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bullmq';
import { GoogleCloudAIService } from './google.cloud.ai.service';
import { EmailService } from './email.service';

@Processor('email')
export class EmailProcessor {
  constructor(
    private readonly googleCloudAIService: GoogleCloudAIService,
    private readonly emailService: EmailService,
    @InjectQueue('email') private readonly emailQueue: Queue
  ) {}

  @Process('process-emails')
  async handleProcessEmails(job: Job) {
    console.log(`Job started: ${job.id}`);
    
    // Fetch emails from Gmail and Outlook
    const gmailEmails = await this.emailService.fetchEmails('gmail', 'me');
    const outlookEmails = await this.emailService.fetchEmails('outlook', 'me');

    console.log('Fetched Gmail emails:', gmailEmails);
    console.log('Fetched Outlook emails:', outlookEmails);

    // Queue email processing tasks for Gmail emails
    for (const email of gmailEmails) {
      await this.emailQueue.add('process-email', { service: 'gmail', emailId: email.id, content: email.content });
      console.log(`Queued Gmail email for processing: ${email.id}`);
    }

    // Queue email processing tasks for Outlook emails
    for (const email of outlookEmails) {
      await this.emailQueue.add('process-email', { service: 'outlook', emailId: email.id, content: email.content });
      console.log(`Queued Outlook email for processing: ${email.id}`);
    }

    console.log(`Job completed: ${job.id}`);
  }

  @Process('process-email')
  async handleProcessEmail(job: Job) {
    console.log(`Processing email: ${job.data.emailId} from ${job.data.service}`);

    const { service, emailId, content } = job.data;

    // Analyze email content
    // const category = await this.googleCloudAIService.categorizeEmail(content);
    // console.log(`Email categorized: ${category}`);
    const category = await this.googleCloudAIService.getCategoryFromSentiment(content);
    console.log(`Email categorized: ${category}`);

    // Generate email response
    const response = await this.googleCloudAIService.generateResponse(category);
    console.log(`Generated response: ${response}`);

    // Construct email object
    const email = { service, id: emailId, content };

    // Send email response
    await this.emailService.sendResponse(email, response);
    console.log(`Response sent for email: ${emailId}`);
  }
}
