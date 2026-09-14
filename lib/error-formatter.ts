/**
 * Utility to convert raw errors, server exceptions, and validation failures
 * into human-friendly, user-understandable error objects.
 */

export interface FormattedError {
  title: string;
  message: string;
  field?: string;
  code?: string;
  actionHint?: string;
}

export function formatFriendlyError(rawError: unknown): FormattedError {
  let errStr = '';

  if (typeof rawError === 'string') {
    errStr = rawError;
  } else if (rawError instanceof Error) {
    errStr = rawError.message;
  } else if (rawError && typeof rawError === 'object') {
    errStr = (rawError as any).message || (rawError as any).error || JSON.stringify(rawError);
  }

  if (!errStr) {
    return {
      title: 'Unexpected Error',
      message: 'Something went wrong while processing your request. Please try again.',
      actionHint: 'If the problem persists, please refresh the page or contact your administrator.',
    };
  }

  // 1. Employee Code Duplicate Error
  if (errStr.includes('Employee Code') || errStr.includes('employeeCode')) {
    return {
      title: 'Duplicate Employee Code',
      message: 'A supervisor or user with this Employee Code already exists in the system.',
      field: 'employeeCode',
      actionHint: 'Please check the supervisor list or enter a unique Employee Code.',
    };
  }

  // 2. Email / Login ID Duplicate Error
  if (errStr.includes('Email') || errStr.includes('Login ID')) {
    return {
      title: 'Duplicate Email Address',
      message: 'An account with this Email / Login ID is already registered.',
      field: 'email',
      actionHint: 'Please use a different email address or search for the existing user account.',
    };
  }

  // 3. Password Validation Error
  if (errStr.toLowerCase().includes('password')) {
    return {
      title: 'Password Requirement Error',
      message: errStr,
      field: 'password',
      actionHint: 'Ensure your password is at least 6 characters long.',
    };
  }

  // 4. Authentication / Session Expiry
  if (errStr.includes('Authentication required') || errStr.includes('Unauthorized')) {
    return {
      title: 'Session Expired',
      message: 'Your login session has expired or is invalid.',
      actionHint: 'Please log in again to continue working.',
    };
  }

  // 5. Permission / Access Denied
  if (errStr.includes('Access denied') || errStr.includes('administrative privileges')) {
    return {
      title: 'Access Restricted',
      message: 'You do not have administrative permission to perform this action.',
      actionHint: 'Contact your system administrator if you believe this is an error.',
    };
  }

  // 6. Inactive Account
  if (errStr.includes('account is inactive')) {
    return {
      title: 'Account Inactive',
      message: 'Your account status is currently set to Inactive.',
      actionHint: 'Please contact an Administrator to activate your supervisor profile.',
    };
  }

  // 7. Data Not Found
  if (errStr.toLowerCase().includes('not found')) {
    return {
      title: 'Record Not Found',
      message: errStr,
      actionHint: 'The requested data might have been deleted or moved.',
    };
  }

  // 8. Excel Import Parsing Error
  if (errStr.includes('Parsing failed') || errStr.includes('Required file')) {
    return {
      title: 'Excel File Import Error',
      message: errStr,
      actionHint: 'Please verify that you have selected valid .xlsx master sheets in the correct format.',
    };
  }

  // 9. Network / Connection Error
  if (errStr.toLowerCase().includes('fetch failed') || errStr.toLowerCase().includes('network')) {
    return {
      title: 'Connection Issue',
      message: 'Unable to communicate with the server.',
      actionHint: 'Please check your internet connection and try submitting again.',
    };
  }

  // Clean up prefix text if any
  const cleanMessage = errStr.replace(/^Error:\s*/i, '').replace(/^Invalid inputs:\s*/i, '');

  return {
    title: 'Action Failed',
    message: cleanMessage,
    actionHint: 'Please review your input details and try again.',
  };
}
