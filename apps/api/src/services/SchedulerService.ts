import { ExpiryAlertService } from './ExpiryAlertService';

export class SchedulerService {
  private static timer: NodeJS.Timeout | null = null;
  private static lastTriggerKey: string = '';

  /**
   * Starts the background scheduler for automated alerts (10:50 AM test, 10:00 AM & 08:00 PM IST)
   */
  static start(): void {
    if (this.timer) return;

    console.log('[SCHEDULER] Daily Expiry Alert Scheduler active (Scheduled for 10:50 AM test, 10:00 AM & 08:00 PM IST)');

    // Run check once every 30 seconds
    this.timer = setInterval(async () => {
      await this.checkAndTrigger().catch((err) => {
        console.error('[SCHEDULER_ERROR] Error during schedule tick:', err.message);
      });
    }, 30 * 1000);
  }

  /**
   * Stops background scheduler (for testing or graceful teardown)
   */
  static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[SCHEDULER] Daily Expiry Alert Scheduler stopped.');
    }
  }

  /**
   * Checks whether the current time in IST matches 10:00 AM or 08:00 PM (20:00)
   * and fires the expiry alert if not already sent in this slot.
   */
  static async checkAndTrigger(nowDate: Date = new Date()): Promise<boolean> {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const parts = formatter.formatToParts(nowDate);
    const getPart = (t: string) => parts.find((p) => p.type === t)?.value || '00';
    const hour = parseInt(getPart('hour'), 10);
    const minute = parseInt(getPart('minute'), 10);
    const dateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;

    // Target windows: 10:50 AM (user test window), 10:00 AM morning, and 08:00 PM (20:00) evening
    const isTargetWindow = (hour === 10 && minute === 50) || (hour === 10 && minute === 0) || (hour === 20 && minute === 0);

    if (!isTargetWindow) {
      return false;
    }

    const triggerKey = `${dateStr}_${hour}_${minute}`;
    if (this.lastTriggerKey === triggerKey) {
      // Already executed in this minute slot
      return false;
    }

    this.lastTriggerKey = triggerKey;
    const slotLabel = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} IST`;
    console.log(`[SCHEDULER] Triggering scheduled Near-Expiry Alert for ${slotLabel} (${dateStr})...`);

    try {
      // Force email delivery during the 10:50 AM test run so owner can verify email arrival even if 0 items are expiring
      const isTestRun = hour === 10 && minute === 50;
      const res = await ExpiryAlertService.sendExpiryAlert({ storeId: 'pulseclinic-main', force: isTestRun });
      console.log(`[SCHEDULER] Near-Expiry Alert sent successfully:`, res);
      return true;
    } catch (err: any) {
      console.error(`[SCHEDULER] Error sending near-expiry alert:`, err.message);
      return false;
    }
  }
}

