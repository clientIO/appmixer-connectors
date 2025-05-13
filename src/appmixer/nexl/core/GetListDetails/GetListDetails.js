'use strict';
const lib = require('../../lib');

const query = `query List($uid: ID!) {
  list(uid: $uid) {
    allowDuplicates
    category
    clean {
      beenCleaned
      cleanEnd
      cleanStart
      id
      percentComplete
      status
      totalBounced
      totalConsentNotGiven
      totalHighRisk
      totalLowRisk
      totalMediumRisk
      totalMembers
      totalUnengaged
      totalUnsubscribed
    }
    contactsCount
    createdAt
    creator {
      accessRole {
        ...AccessRoleFragment
      }
      archivedAt
      canArchiveContactsAndCompanies
      canUpdateCompanyName
      canViewActivityViewDetail
      canViewEmbeddedReport
      email
      employee {
        ...EmployeeFragment
      }
      firstName
      id
      isActive
      lastLoginAt
      lastName
      profileImageUrl
      profileName
      role
      userId
    }
    discardedAt
    id
    memberCustomFields {
      currency {
        ...CurrencyFragment
      }
      id
      name
      optionChoices {
        ...OptionChoiceFragment
      }
      position
      schemaId
      searchable
      usage
      valueTypeEnum
    }
    name
    reminderSettings {
      dateProperty
      emailSubject
      id
      owners {
        ...ReminderSettingOwnerFragment
      }
      reminderDays
      timePreposition
    }
    renderMode
    tabUid
    updatedAt
  }
}

# Define the missing fragments
fragment AccessRoleFragment on AccessRole {
  id
  name
  description
  isPersisted
  updatedAt
}

fragment EmployeeFragment on Employee {
  id
  email
  hidden
  department {
    id
    name
  }
  contact {
    id
  }
  info {
    id
  }
  office {
    id
  }
}

fragment CurrencyFragment on Currency {
  decimalMark
  exponent
  isoCode
  name
  symbol
  symbolFirst
  thousandsSeparator
}

fragment OptionChoiceFragment on OptionChoice {
  id
  optionChoiceId
  colour
  orderRank
  value
}

fragment ReminderSettingOwnerFragment on ReminderSettingOwner {
  id
  employee {
    id
  }
}`;

module.exports = {
    async receive(context) {
        const { uid } = context.messages.in.content;
        const { data } = await lib.makeApiCall({
            context,
            method: 'POST',
            data: { query, variables: { uid } }
        });

        if (data.errors) {
            throw new context.CancelError(data.errors);
        }

        return context.sendJson(data.data.list, 'out');
    }
};
